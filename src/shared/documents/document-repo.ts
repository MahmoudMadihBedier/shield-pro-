/**
 * The shared data layer for **submittable documents** — the ERPNext-style
 * Draft → Submitted → Cancelled records that purchasing, manufacturing,
 * inventory, sales and accounting all create.
 *
 * `makeDocumentRepo` gives a module a typed repo whose lifecycle operations go
 * through the right place:
 *  - `createDraft` calls `allocate_reference_id` for a gap-free `reference_id`,
 *    then writes the Draft row (envelope + the module's own fields).
 *  - `submit` runs the tiered approval engine (`evaluate_approval`) first — a
 *    `force_manual` outcome returns a `pending_approval` error and leaves the
 *    row a Draft; otherwise `submit_document` performs the transition. `cancel`
 *    calls `cancel_document`. The client never flips `doc_status` itself.
 *  - `list` / `get` / `updateDraft` are plain reads/writes; a Draft is editable
 *    by its creator (RLS grants that), a Submitted row is not (RLS has no
 *    client UPDATE policy once `doc_status <> 0`).
 *
 * Every method returns `Result<T, AppError>`.
 */
import type { ZodType } from 'zod'

import { DocStatus } from '@/core/doc-status'
import {
  type SubmittableDocTable,
  type SubmittableEntity,
  tableForEntity,
} from '@/core/document'
import { appError, type AppError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import {
  allocateReferenceId,
  cancelDocument as cancelDocumentFn,
  evaluateApproval,
  submitDocument as submitDocumentFn,
  type EvaluateApprovalPayload,
} from '@/infrastructure/appwrite/functions'
import { ID, Query, tablesDB } from '@/infrastructure/appwrite/services'

/** Who is creating the draft — supplied by the presentation layer from the `Principal`. */
export interface DocumentActor {
  userId: string
  branchId?: string | null
}

/** Envelope fields the caller may override; the rest are derived. */
export interface DraftEnvelopeExtras {
  branchId?: string | null
  remarks?: string | null
  amendedFrom?: string | null
  /** Defaults to now; `/submit-document` re-stamps it at submit time anyway. */
  postingDatetime?: string
}

export interface DocumentListParams {
  docStatus?: DocStatus
  branchId?: string
  /** `startsWith` on `reference_id`. */
  search?: string
  page?: number
  pageSize?: number
  sort?: { column: string; dir: 'asc' | 'desc' }
}

export interface DocumentListPage<TRow> {
  rows: TRow[]
  total: number
}

export interface DocumentTransitionResult {
  referenceId: string
  docStatus: number
  postingDatetime?: string
}

/**
 * Generic approval-engine context lifted straight off a raw document row. The
 * load-bearing enrichment — new customer, over credit limit, branch — happens
 * server-side in `evaluate_approval`; this only forwards the couple of fields a
 * row plainly carries so a client-known price override still counts.
 */
function buildApprovalContext(
  raw: Record<string, unknown>,
): EvaluateApprovalPayload['context'] {
  const ctx: EvaluateApprovalPayload['context'] = {}
  const amount = raw.net_total ?? raw.grand_total ?? raw.amount ?? raw.total
  if (typeof amount === 'number' && Number.isFinite(amount)) ctx.amount = amount
  if (typeof raw.is_price_override === 'boolean') ctx.isPriceOverride = raw.is_price_override
  return ctx
}

export interface DocumentRepo<TRow, TDraftFields extends Record<string, unknown>> {
  readonly entity: SubmittableEntity
  readonly table: SubmittableDocTable
  list(params?: DocumentListParams): Promise<Result<DocumentListPage<TRow>>>
  get(id: string): Promise<Result<TRow>>
  createDraft(
    fields: TDraftFields,
    actor: DocumentActor,
    extras?: DraftEnvelopeExtras,
  ): Promise<Result<TRow>>
  updateDraft(id: string, patch: Partial<TDraftFields>): Promise<Result<TRow>>
  submit(id: string): Promise<Result<DocumentTransitionResult>>
  cancel(id: string, reason: string): Promise<Result<DocumentTransitionResult>>
}

const DEFAULT_PAGE_SIZE = 25

export function makeDocumentRepo<TRow, TDraftFields extends Record<string, unknown>>(config: {
  entity: SubmittableEntity
  rowSchema: ZodType<TRow>
}): DocumentRepo<TRow, TDraftFields> {
  const { entity, rowSchema } = config
  const table = tableForEntity(entity)

  function parseRow(raw: unknown): Result<TRow> {
    const parsed = rowSchema.safeParse(raw)
    if (parsed.success) return ok(parsed.data)
    return err(
      appError('server', 'The server returned a document in an unexpected shape.', {
        detail: parsed.error.message,
      }),
    )
  }

  return {
    entity,
    table,

    async list(params = {}) {
      const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
      const page = params.page ?? 0
      const queries: string[] = [Query.limit(pageSize), Query.offset(page * pageSize)]
      if (params.docStatus !== undefined) queries.push(Query.equal('doc_status', params.docStatus))
      if (params.branchId) queries.push(Query.equal('branch_id', params.branchId))
      if (params.search) queries.push(Query.startsWith('reference_id', params.search))
      if (params.sort) {
        queries.push(
          params.sort.dir === 'asc'
            ? Query.orderAsc(params.sort.column)
            : Query.orderDesc(params.sort.column),
        )
      } else {
        queries.push(Query.orderDesc('$createdAt'))
      }

      try {
        const res = await tablesDB.listRows({ databaseId: DATABASE_ID, tableId: table, queries })
        const rows: TRow[] = []
        for (const raw of res.rows) {
          const parsed = parseRow(raw)
          if (!parsed.ok) return parsed
          rows.push(parsed.value)
        }
        return ok({ rows, total: res.total })
      } catch (e) {
        return err(mapAppwriteError(e))
      }
    },

    async get(id) {
      try {
        const raw = await tablesDB.getRow({ databaseId: DATABASE_ID, tableId: table, rowId: id })
        return parseRow(raw)
      } catch (e) {
        return err(mapAppwriteError(e))
      }
    },

    async createDraft(fields, actor, extras = {}) {
      const allocated = await allocateReferenceId(entity)
      if (!allocated.ok) return allocated

      const data: Record<string, unknown> = {
        ...fields,
        reference_id: allocated.value.referenceId,
        doc_status: DocStatus.Draft,
        created_by: actor.userId,
        branch_id: extras.branchId ?? actor.branchId ?? null,
        amended_from: extras.amendedFrom ?? null,
        posting_datetime: extras.postingDatetime ?? new Date().toISOString(),
        remarks: extras.remarks ?? null,
      }

      try {
        const raw = await tablesDB.createRow({
          databaseId: DATABASE_ID,
          tableId: table,
          rowId: ID.unique(),
          data,
        })
        return parseRow(raw)
      } catch (e) {
        return err(mapAppwriteError(e))
      }
    },

    async updateDraft(id, patch) {
      try {
        const raw = await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: table,
          rowId: id,
          data: patch,
        })
        return parseRow(raw)
      } catch (e) {
        return err(mapAppwriteError(e))
      }
    },

    /**
     * Draft → Submitted, gated by the tiered approval engine (Plan §4.5):
     *  - runs `evaluate_approval` for this movement (`table`) + `reference_id`;
     *  - `auto_approve` (or a replayed, already-approved request) → the
     *    `submit-document` transition runs;
     *  - `force_manual` → the draft stays a draft and the caller gets a
     *    `pending_approval` error; an admin clears it from the Exceptions
     *    dashboard, then a re-submit replays as `auto_approve` and proceeds.
     */
    async submit(id) {
      let raw: Record<string, unknown>
      try {
        raw = (await tablesDB.getRow({
          databaseId: DATABASE_ID,
          tableId: table,
          rowId: id,
        })) as Record<string, unknown>
      } catch (e) {
        return err(mapAppwriteError(e))
      }

      const referenceId = typeof raw.reference_id === 'string' ? raw.reference_id : ''
      if (!referenceId) {
        return err(
          appError('server', 'This document has no reference id and cannot be submitted.'),
        )
      }

      const evaluation = await evaluateApproval({
        movementType: table,
        entityRef: referenceId,
        context: buildApprovalContext(raw),
      })
      if (!evaluation.ok) return evaluation

      if (evaluation.value.action === 'force_manual') {
        return err(
          appError(
            'pending_approval',
            'تم إرسال المستند لمراجعة الاعتماد — لا يمكن ترحيله قبل الموافقة عليه من لوحة الاستثناءات.',
            { detail: `approvalRequestId=${evaluation.value.approvalRequestId}` },
          ),
        )
      }

      return submitDocumentFn(table, id) as Promise<Result<DocumentTransitionResult>>
    },

    cancel(id, reason) {
      return cancelDocumentFn(table, id, reason) as Promise<Result<DocumentTransitionResult>>
    },
  }
}

export type { AppError }
