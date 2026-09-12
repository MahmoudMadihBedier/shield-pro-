/**
 * Data layer for `crm_followups` (migration 0030) — branch-scoped follow-up
 * tasks tied to a customer.
 *
 * Contract (`claude.md` B.5): catch raw errors → typed `AppError`; Zod-parse
 * every row; return `Result<T, AppError>` — never throw across the boundary.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { ID, Query, tablesDB } from '@/infrastructure/appwrite/services'

import { followupRowSchema, type FollowupRow, type FollowupStatus } from '../domain/followup'

const SHAPE_ERROR = 'تعذّر قراءة قائمة المتابعات — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

const MAX_ROWS = 200

function parseRow(raw: unknown): Result<FollowupRow> {
  const parsed = followupRowSchema.safeParse(raw)
  return parsed.success
    ? ok(parsed.data)
    : err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
}

/**
 * Every OPEN follow-up assigned to `userId`, across every customer
 * (branch-scoped server-side via RLS — no `customer_id` filter needed). For
 * the "my open follow-ups" widget on the CRM hub.
 */
export async function listMyOpenFollowups(userId: string): Promise<Result<FollowupRow[]>> {
  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.crmFollowups,
      queries: [
        Query.equal('assigned_to', userId),
        Query.equal('status', 'open'),
        Query.orderAsc('due_date'),
        Query.limit(MAX_ROWS),
      ],
    })
    const out: FollowupRow[] = []
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

/** Every follow-up for one customer (open and closed). */
export async function listFollowups(customerId: string): Promise<Result<FollowupRow[]>> {
  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.crmFollowups,
      queries: [
        Query.equal('customer_id', customerId),
        Query.orderAsc('due_date'),
        Query.limit(MAX_ROWS),
      ],
    })
    const out: FollowupRow[] = []
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

export interface CreateFollowupInput {
  customerId: string
  createdBy: string
  assignedTo: string
  title: string
  notes?: string | null
  /** `YYYY-MM-DD`. */
  dueDate: string
}

export async function createFollowup(input: CreateFollowupInput): Promise<Result<FollowupRow>> {
  try {
    const created = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: Tables.crmFollowups,
      rowId: ID.unique(),
      // `branch_id` is set server-side by the `crm_followups_branch` trigger
      // from the customer — never sent from here.
      data: {
        customer_id: input.customerId,
        created_by: input.createdBy,
        assigned_to: input.assignedTo,
        title: input.title,
        notes: input.notes?.trim() ? input.notes.trim() : null,
        due_date: input.dueDate,
        status: 'open',
      },
    })
    return parseRow(created)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/** Mark a follow-up done or cancelled (the creator or the assignee only, per RLS). */
export async function setFollowupStatus(
  id: string,
  status: Extract<FollowupStatus, 'done' | 'cancelled'>,
  doneBy: string,
): Promise<Result<FollowupRow>> {
  try {
    const updated = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: Tables.crmFollowups,
      rowId: id,
      data: {
        status,
        done_at: new Date().toISOString(),
        done_by: doneBy,
      },
    })
    return parseRow(updated)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/** Reopen a done/cancelled follow-up. */
export async function reopenFollowup(id: string): Promise<Result<FollowupRow>> {
  try {
    const updated = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: Tables.crmFollowups,
      rowId: id,
      data: { status: 'open', done_at: null, done_by: null },
    })
    return parseRow(updated)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/** Remove one follow-up (the creator only, per RLS). */
export async function deleteFollowup(id: string): Promise<Result<null>> {
  try {
    await tablesDB.deleteRow({
      databaseId: DATABASE_ID,
      tableId: Tables.crmFollowups,
      rowId: id,
    })
    // `deleteRow` cannot report an RLS-filtered no-op — confirm the row is
    // gone so a denied delete surfaces as an error, not a silent "success"
    // (same fix as `activities-repo.deleteActivity`).
    const check = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.crmFollowups,
      queries: [Query.equal('$id', id), Query.limit(1), Query.noCount()],
    })
    if (check.rows.length > 0) {
      return err(appError('forbidden', 'لا تملك صلاحية حذف هذه المتابعة.'))
    }
    return ok(null)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
