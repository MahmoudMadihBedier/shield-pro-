/**
 * Data layer for `leads` (migration 0031) — the opportunity pipeline.
 *
 * Contract (`claude.md` B.5): catch raw errors → typed `AppError`; Zod-parse
 * every row; return `Result<T, AppError>` — never throw across the boundary.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { ID, Query, tablesDB } from '@/infrastructure/appwrite/services'

import {
  leadRowSchema,
  leadStageEventRowSchema,
  type LeadImportRow,
  type LeadRow,
  type LeadStage,
  type LeadStageEvent,
} from '../domain/lead'

const SHAPE_ERROR =
  'تعذّر قراءة قائمة العملاء المحتملين — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'
const EVENT_SHAPE_ERROR =
  'تعذّر قراءة سجل تغييرات المرحلة — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

const MAX_ROWS = 300

function parseRow(raw: unknown): Result<LeadRow> {
  const parsed = leadRowSchema.safeParse(raw)
  return parsed.success
    ? ok(parsed.data)
    : err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
}

/** Every lead this caller can see (branch-scoped server-side). */
export async function listLeads(): Promise<Result<LeadRow[]>> {
  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.leads,
      queries: [Query.orderDesc('$createdAt'), Query.limit(MAX_ROWS)],
    })
    const out: LeadRow[] = []
    for (const raw of res.rows) {
      const parsed = parseRow(raw)
      if (!parsed.ok) return parsed
      out.push(parsed.value)
    }
    return ok(out)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/** One lead by id. */
export async function getLead(id: string): Promise<Result<LeadRow>> {
  try {
    const row = await tablesDB.getRow({ databaseId: DATABASE_ID, tableId: Tables.leads, rowId: id })
    return parseRow(row)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export interface UpdateLeadInput {
  name: string
  phone?: string | null
  email?: string | null
  source?: string | null
  estimatedValue: number
  notes?: string | null
  assignedTo: string
}

/** Edit a lead's plain fields (not `stage` — see `setLeadStage`). */
export async function updateLead(id: string, input: UpdateLeadInput): Promise<Result<LeadRow>> {
  try {
    const updated = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: Tables.leads,
      rowId: id,
      data: {
        name: input.name,
        phone: input.phone?.trim() ? input.phone.trim() : null,
        email: input.email?.trim() ? input.email.trim() : null,
        source: input.source || null,
        estimated_value: input.estimatedValue,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        assigned_to: input.assignedTo,
      },
    })
    return parseRow(updated)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/**
 * A lead's normal lifecycle produces a handful of these (one per stage move);
 * `system_admin` is exempt from the transition guard (migration 0033) and
 * could in principle rack up far more via repeated overrides, so the read is
 * still capped rather than unbounded — `LEAD_STAGE_EVENTS_CAP` lets the UI
 * show a "history may be truncated" note instead of silently dropping the
 * oldest events with no signal.
 */
export const LEAD_STAGE_EVENTS_CAP = 100

/** The stage-change history for one lead, written server-side (migration 0034). */
export async function listLeadStageEvents(leadId: string): Promise<Result<LeadStageEvent[]>> {
  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.leadStageEvents,
      queries: [
        Query.equal('lead_id', leadId),
        Query.orderDesc('changed_at'),
        Query.limit(LEAD_STAGE_EVENTS_CAP),
      ],
    })
    const out: LeadStageEvent[] = []
    for (const raw of res.rows) {
      const parsed = leadStageEventRowSchema.safeParse(raw)
      if (!parsed.success) {
        return err(appError('server', EVENT_SHAPE_ERROR, { detail: parsed.error.message }))
      }
      out.push(parsed.data)
    }
    return ok(out)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export interface CreateLeadInput {
  createdBy: string
  assignedTo: string
  name: string
  phone?: string | null
  email?: string | null
  source?: string | null
  estimatedValue?: number | null
  notes?: string | null
}

export async function createLead(input: CreateLeadInput): Promise<Result<LeadRow>> {
  try {
    const created = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: Tables.leads,
      rowId: ID.unique(),
      // `branch_id` is set server-side by the `leads_branch` trigger from the
      // caller's own branch — never sent from here.
      data: {
        created_by: input.createdBy,
        assigned_to: input.assignedTo,
        name: input.name,
        phone: input.phone?.trim() ? input.phone.trim() : null,
        email: input.email?.trim() ? input.email.trim() : null,
        source: input.source || null,
        estimated_value: input.estimatedValue ?? null,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        stage: 'new',
      },
    })
    return parseRow(created)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export interface BulkImportLeadsResult {
  applied: number
  skipped: number
  /** One message per row that failed, in input order — surfaced to the importer. */
  errors: string[]
}

/**
 * Create one lead per validated CSV row (`CsvImportPanel`), all self-assigned
 * to `createdBy` (see `leadImportRowSchema`'s doc comment for why). Applies
 * rows one at a time and keeps going past a single row's failure — a bad row
 * in a 50-row import should not cost the other 49 (no partial-import
 * transaction exists to roll back to anyway; `leads` is not a ledger).
 */
export async function bulkImportLeads(
  rows: readonly LeadImportRow[],
  createdBy: string,
): Promise<Result<BulkImportLeadsResult>> {
  let applied = 0
  const errors: string[] = []
  for (const row of rows) {
    const res = await createLead({
      createdBy,
      assignedTo: createdBy,
      name: row.name,
      phone: row.phone || null,
      email: row.email || null,
      source: row.source || null,
      estimatedValue: row.estimated_value ?? null,
      notes: row.notes || null,
    })
    if (res.ok) applied += 1
    else errors.push(`${row.name}: ${res.error.message}`)
  }
  return ok({ applied, skipped: errors.length, errors })
}

/** Move a lead to any stage; `lost` should carry `lostReason`. */
export async function setLeadStage(
  id: string,
  stage: LeadStage,
  lostReason?: string | null,
): Promise<Result<LeadRow>> {
  try {
    const updated = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: Tables.leads,
      rowId: id,
      data: {
        stage,
        lost_reason: stage === 'lost' ? (lostReason?.trim() ?? null) : null,
      },
    })
    return parseRow(updated)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/** Link a won lead to the customer record created for it. */
export async function linkConvertedCustomer(
  id: string,
  customerId: string,
): Promise<Result<LeadRow>> {
  try {
    const updated = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: Tables.leads,
      rowId: id,
      data: { stage: 'won', converted_customer_id: customerId },
    })
    return parseRow(updated)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/** Remove one lead (the creator only, per RLS). */
export async function deleteLead(id: string): Promise<Result<null>> {
  try {
    await tablesDB.deleteRow({ databaseId: DATABASE_ID, tableId: Tables.leads, rowId: id })
    // `deleteRow` cannot report an RLS-filtered no-op — confirm the row is
    // gone so a denied delete surfaces as an error, not a silent "success".
    const check = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.leads,
      queries: [Query.equal('$id', id), Query.limit(1), Query.noCount()],
    })
    if (check.rows.length > 0) {
      return err(appError('forbidden', 'لا تملك صلاحية حذف هذا العميل المحتمل.'))
    }
    return ok(null)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
