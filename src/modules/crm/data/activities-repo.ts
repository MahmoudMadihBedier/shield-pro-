/**
 * Data layer for `crm_activities` (migration 0029) — a branch-scoped,
 * append-mostly log of interactions with an existing customer.
 *
 * Contract (`claude.md` B.5): catch raw errors → typed `AppError`; Zod-parse
 * every row; return `Result<T, AppError>` — never throw across the boundary.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { ID, Query, tablesDB } from '@/infrastructure/appwrite/services'

import { activityRowSchema, type ActivityKind, type ActivityRow } from '../domain/activity'

const SHAPE_ERROR = 'تعذّر قراءة سجل النشاط — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

const MAX_ROWS = 200

function parseRow(raw: unknown): Result<ActivityRow> {
  const parsed = activityRowSchema.safeParse(raw)
  return parsed.success
    ? ok(parsed.data)
    : err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
}

/** All logged activities for one customer, newest-first from the server. */
export async function listActivities(customerId: string): Promise<Result<ActivityRow[]>> {
  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.crmActivities,
      queries: [
        Query.equal('customer_id', customerId),
        Query.orderDesc('occurred_at'),
        Query.limit(MAX_ROWS),
      ],
    })
    const out: ActivityRow[] = []
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

export interface LogActivityInput {
  customerId: string
  /** Auth user id of the staff member logging this (RLS: must equal auth.uid()). */
  createdBy: string
  kind: ActivityKind
  subject: string
  note?: string | null
  /** ISO datetime the interaction happened. */
  occurredAt: string
  outcome?: string | null
}

export async function logActivity(input: LogActivityInput): Promise<Result<ActivityRow>> {
  try {
    const created = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: Tables.crmActivities,
      rowId: ID.unique(),
      // `branch_id` is set server-side by the `crm_activities_branch` trigger
      // from the customer — never sent from here.
      data: {
        customer_id: input.customerId,
        created_by: input.createdBy,
        kind: input.kind,
        subject: input.subject,
        note: input.note?.trim() ? input.note.trim() : null,
        occurred_at: input.occurredAt,
        outcome: input.outcome || null,
      },
    })
    return parseRow(created)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/** Remove one activity (own row, or System Admin). */
export async function deleteActivity(id: string): Promise<Result<null>> {
  try {
    await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: Tables.crmActivities,
      rowId: id,
    })
    // `deleteRow` cannot report an RLS-filtered no-op — confirm the row is gone
    // so a denied delete surfaces as an error, not a silent "success".
    const check = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.crmActivities,
      queries: [Query.equal('$id', id), Query.limit(1), Query.noCount()],
    })
    if (check.rows.length > 0) {
      return err(appError('forbidden', 'لا تملك صلاحية حذف هذا النشاط.'))
    }
    return ok(null)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
