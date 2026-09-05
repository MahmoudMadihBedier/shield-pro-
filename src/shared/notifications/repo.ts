/**
 * Read/write repository for `notifications`. The table is provisioned with
 * `rowSecurity: true` and a collection-level `read(users())` grant only
 * (`scripts/appwrite/schema.ts`) — every signed-in staff account can read
 * every row (a known, accepted platform limitation tracked as Phase 4 Story
 * 4.3; real row-scoping isn't enforced server-side yet). Every query here
 * therefore **always** filters by `recipient_user_id` so the UI is correct
 * regardless. Writes (`markRead`/`markAllRead`) work because
 * `functions/common/notifications.ts::createNotification` stamps each row
 * with an `update(user(recipientUserId))` permission at creation time — only
 * that one recipient can flip their own `is_read`, straight from this repo,
 * no Function round-trip needed for that narrow, self-scoped mutation.
 *
 * Shape mirrors `src/modules/fraud/data/fraud-flags-repo.ts`.
 *
 * Contract (`claude.md` B.5): catch raw Appwrite errors → typed `AppError`;
 * Zod-parse every row; return `Result<T, AppError>` — never throw across the
 * boundary.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
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
