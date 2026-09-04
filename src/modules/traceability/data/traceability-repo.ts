/**
 * Traceability data layer — reads the Appwrite document tables and the audit
 * log, and hands the domain walker a `ChainNode` resolver.
 *
 * Every Appwrite call is wrapped: raw errors become a typed `AppError`
 * (`mapAppwriteError`) and every row is parsed through a Zod schema before it
 * leaves this module (`claude.md` B.2 / B.5).
 *
 * Read budget per node (`resolveNode`):
 *   1 `listRows` to fetch the row by `reference_id`
 * + 1 `listRows` per distinct reverse-lookup table (14 submittable doc tables;
 *   columns on the same table are OR-ed into a single query)
 * = 15 reads per node worst case — O(nodes), never N+1 per field.
 */
import { z } from 'zod'

import { documentEnvelopeSchema } from '@/core/document'
import { appError } from '@/core/errors'
import { parseReferenceId } from '@/core/reference-id'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'

import type { ChainNode } from '../domain/chain-walker'
import {
  PREFIX_LINKS,
  UNIVERSAL_PARENT_COLUMNS,
  reverseLookupsByTable,
} from '../domain/link-fields'

/** Max children pulled per reverse-lookup table per node. */
const CHILD_PAGE_LIMIT = 100

/** Default page size for the audit-log viewer. */
export const DEFAULT_AUDIT_LIMIT = 50

// ---------------------------------------------------------------------------
// Row schemas (boundary validation)
// ---------------------------------------------------------------------------

const optionalRef = z.string().trim().optional().nullable()

/**
 * The document envelope (`@/core/document`) plus the Appwrite system fields and
 * the cross-document link columns this module follows.
 */
export const docEnvelopeRowSchema = documentEnvelopeSchema.extend({
  $id: z.string(),
  $createdAt: z.string(),
  purchase_order_ref: optionalRef,
  production_request_ref: optionalRef,
  origin_ref: optionalRef,
  invoice_ref: optionalRef,
})

export type DocEnvelopeRow = z.infer<typeof docEnvelopeRowSchema>

export const auditRowSchema = z.object({
  $id: z.string(),
  actor_id: z.string(),
  action: z.string(),
  entity_type: z.string(),
  entity_ref: z.string(),
  before: z.string().optional().nullable(),
  after: z.string().optional().nullable(),
  created_at: z.string(),
})

export type AuditRow = z.infer<typeof auditRowSchema>

// ---------------------------------------------------------------------------
// resolveNode
// ---------------------------------------------------------------------------

function dedupe(values: string[]): string[] {
  return [...new Set(values)]
}

function refCell(raw: Record<string, unknown>, column: string): string | null {
  const value = raw[column]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

async function collectChildren(refId: string): Promise<string[]> {
  const found: string[] = []
  for (const { table, columns } of reverseLookupsByTable()) {
    const filter =
      columns.length === 1
        ? Query.equal(columns[0]!, refId)
        : Query.or(columns.map((column) => Query.equal(column, refId)))

    const list = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: table,
      queries: [filter, Query.select(['reference_id']), Query.limit(CHILD_PAGE_LIMIT)],
    })

    for (const child of list.rows) {
      const childRef = refCell(child as Record<string, unknown>, 'reference_id')
      if (childRef && childRef !== refId) found.push(childRef)
    }
  }
  return dedupe(found)
}

/**
 * Resolve one reference id into a `ChainNode`.
 *
 * Returns `ok(null)` when the id is unparseable, its prefix is not a walkable
 * document, or no row carries it — the domain walker treats that as "missing".
 */
export async function resolveNode(refId: string): Promise<Result<ChainNode | null>> {
  const parsed = parseReferenceId(refId)
  if (!parsed) return ok(null)

  const link = PREFIX_LINKS[parsed.prefix]
  if (!link) return ok(null)

  try {
    const list = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: link.table,
      queries: [Query.equal('reference_id', refId), Query.limit(1)],
    })

    const raw = list.rows[0]
    if (!raw) return ok(null)

    const parsedRow = docEnvelopeRowSchema.safeParse(raw)
    if (!parsedRow.success) {
      return err(
        appError(
          'server',
          'A traceability record is stored in an unexpected shape. Contact support if this persists.',
          { detail: `${link.table}/${refId}: ${parsedRow.error.message}` },
        ),
      )
    }
    const row = parsedRow.data

    const parentColumns = [...link.parentRefColumns, ...UNIVERSAL_PARENT_COLUMNS]
    const parents = dedupe(
      parentColumns
        .map((column) => refCell(raw as Record<string, unknown>, column))
        .filter((value): value is string => value !== null),
    )

    const children = await collectChildren(refId)

    return ok({
      refId,
      entityType: link.table,
      docStatus: row.doc_status,
      parents,
      children,
      createdAt: row.$createdAt,
    })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

// ---------------------------------------------------------------------------
// getAuditTrail
// ---------------------------------------------------------------------------

export interface AuditTrailParams {
  entityRef?: string
  actorId?: string
  limit?: number
  cursor?: string
}

export interface AuditTrailPage {
  rows: AuditRow[]
  nextCursor?: string
}

export async function getAuditTrail(
  params: AuditTrailParams = {},
): Promise<Result<AuditTrailPage>> {
  const limit = params.limit ?? DEFAULT_AUDIT_LIMIT
  const queries = [Query.orderDesc('created_at'), Query.limit(limit)]
  if (params.entityRef) queries.push(Query.equal('entity_ref', params.entityRef))
  if (params.actorId) queries.push(Query.equal('actor_id', params.actorId))
  if (params.cursor) queries.push(Query.cursorAfter(params.cursor))

  try {
    const list = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.auditLog,
      queries,
    })

    const rows: AuditRow[] = []
    for (const raw of list.rows) {
      const parsed = auditRowSchema.safeParse(raw)
      if (!parsed.success) {
        return err(
          appError(
            'server',
            'An audit-log entry could not be read. Contact support if this persists.',
            { detail: parsed.error.message },
          ),
        )
      }
      rows.push(parsed.data)
    }

    const nextCursor =
      rows.length === limit && rows.length > 0 ? rows[rows.length - 1]!.$id : undefined
    return ok({ rows, nextCursor })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
