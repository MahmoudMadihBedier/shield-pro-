/**
 * Read/write repository for `notifications`. RLS (migration 0001) scopes both
 * SELECT and UPDATE to `recipient_user_id = auth.uid()` — a signed-in staff
 * member only ever sees or marks-read their own rows; the query filters here
 * are belt-and-suspenders, not the real enforcement. There is no client
 * INSERT policy at all — every notification is written by a `SECURITY
 * DEFINER` RPC (`_notify_system_admins`, `sync_overdue_followup_notifications`, …).
 *
 * Shape mirrors `src/modules/fraud/data/fraud-flags-repo.ts`.
 *
 * Contract (`claude.md` B.5): catch raw Supabase errors → typed `AppError`;
 * Zod-parse every row; return `Result<T, AppError>` — never throw across the
 * boundary.
 */
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { supabase } from '@/infrastructure/appwrite/client'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'

import { notificationRowSchema, type Notification } from './domain'

const SHAPE_ERROR = 'تعذّر قراءة أحد الإشعارات — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

const DEFAULT_PAGE_SIZE = 10
/** Cap on how many unread rows `markAllRead` will ever touch in one call. */
const MARK_ALL_FETCH_LIMIT = 200

export interface NotificationListParams {
  recipientUserId: string
  onlyUnread?: boolean
  page?: number
  pageSize?: number
}

export interface NotificationListPage {
  rows: Notification[]
  total: number
}

function parseRows(raw: ReadonlyArray<unknown>): Result<Notification[]> {
  const rows: Notification[] = []
  for (const row of raw) {
    const parsed = notificationRowSchema.safeParse(row)
    if (!parsed.success) {
      return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
    }
    rows.push(parsed.data)
  }
  return ok(rows)
}

export async function listNotifications(
  params: NotificationListParams,
): Promise<Result<NotificationListPage>> {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const page = params.page ?? 0
  const queries: string[] = [
    Query.equal('recipient_user_id', params.recipientUserId),
    Query.orderDesc('created_at'),
    Query.limit(pageSize),
    Query.offset(page * pageSize),
  ]
  if (params.onlyUnread) queries.push(Query.equal('is_read', false))

  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.notifications,
      queries,
    })
    const parsed = parseRows(res.rows)
    if (!parsed.ok) return parsed
    return ok({ rows: parsed.value, total: res.total })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export async function markRead(id: string): Promise<Result<Notification>> {
  try {
    const res = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: Tables.notifications,
      rowId: id,
      data: { is_read: true },
    })
    const parsed = notificationRowSchema.safeParse(res)
    if (!parsed.success) {
      return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
    }
    return ok(parsed.data)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/**
 * No bulk-update endpoint exists on `TablesDB` — fetch every unread row for
 * this recipient and `updateRow` each one in turn.
 */
export async function markAllRead(recipientUserId: string): Promise<Result<void>> {
  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.notifications,
      queries: [
        Query.equal('recipient_user_id', recipientUserId),
        Query.equal('is_read', false),
        Query.limit(MARK_ALL_FETCH_LIMIT),
      ],
    })
    for (const row of res.rows) {
      const id = (row as { $id?: unknown }).$id
      if (typeof id !== 'string') continue
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: Tables.notifications,
        rowId: id,
        data: { is_read: true },
      })
    }
    return ok(undefined)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/**
 * "Check on read" sync for CRM follow-ups (docs/CRM_PLAN.md Phase A #2, no
 * scheduled job yet): notifies the caller — server-side, idempotent — for
 * each of their own follow-ups that has gone overdue since the last check.
 * Returns how many new notifications were created. Called opportunistically
 * on app load (`useSyncOverdueFollowupNotifications`), not on a timer.
 */
const syncCountSchema = z.number().int().nonnegative()

export async function syncOverdueFollowupNotifications(): Promise<Result<number>> {
  try {
    const { data, error } = await supabase.rpc('sync_overdue_followup_notifications')
    if (error) return err(mapAppwriteError(error))
    const parsed = syncCountSchema.safeParse(data)
    if (!parsed.success) {
      return err(
        appError('server', 'تعذّر مزامنة إشعارات المتابعات المتأخرة — استجابة غير متوقعة.', {
          detail: parsed.error.message,
        }),
      )
    }
    return ok(parsed.data)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
