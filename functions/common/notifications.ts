/**
 * Reusable helper other Functions call to write a `notifications` row
 * (Implementation Plan §4 / Phase 2 Story 2.6). `notifications` is a
 * control-plane table with no client write permission — a Function is the
 * only writer, the same shape as `./audit.ts::appendAudit`.
 */
import { ID, Permission, Query, Role as AppwriteRole, type TablesDB } from 'node-appwrite'

import { Role } from '@/core/rbac'

import { DATABASE_ID } from './appwrite'
import { parseRoles } from './caller'

const NOTIFICATIONS_TABLE = 'notifications'
const USERS_TABLE = 'users'

/** Cap every `users` fan-out lookup — a small staff base, not a mass table. */
const USERS_FETCH_LIMIT = 1000

/** Column caps from `scripts/appwrite/schema.ts` — `notifications`. */
const RECIPIENT_MAX = 36
const KIND_MAX = 48
const TITLE_MAX = 200
const BODY_MAX = 2000
const ENTITY_REF_MAX = 32

export interface NewNotification {
  /** The recipient's Appwrite Auth `$id` (`users.auth_user_id`). Max 36 chars. */
  recipientUserId: string
  /** Short machine-readable event kind, e.g. `fraud_flag`. Max 48 chars. */
  kind: string
  /** Short human-readable title. Max 200 chars. */
  title: string
  body?: string
  /** The related entity's `reference_id` / subject id, if any. Max 32 chars —
   *  the same value truncated to a *different* cap elsewhere (e.g.
   *  `fraud_flags.subject_id`, 36 chars) always comes out as an exact prefix
   *  of the longer value, since both are `slice(0, N)` of the same source
   *  string — so the two never disagree, one is just shorter. */
  entityRef?: string
}

/**
 * Create one `notifications` row. Truncates every string column to its schema
 * cap, same as `appendAudit`. Does not catch/guard against anything beyond
 * what `createRow` itself throws — a missed notification shouldn't silently
 * vanish, so the caller decides whether that failure should fail the whole
 * request. **Callers that run inside `runInTransaction` (`./transaction.ts`)
 * must wrap this in their own try/catch** — an uncaught throw here would roll
 * back whatever real business rows the same transaction already wrote, which
 * is never the intent of a side-effecting notification.
 *
 * `notifications` is provisioned with `rowSecurity: true` and only a
 * collection-level `read(users())` grant (`scripts/appwrite/schema.ts`) — no
 * client can write at all unless a row also carries its own permission. Here
 * every row is stamped with `update(user(recipientUserId))` so the one
 * recipient (and only them) can flip `is_read` from the browser SDK
 * (`src/shared/notifications/repo.ts::markRead`/`markAllRead`) without a
 * Function round-trip; nobody else gains any write access.
 */
export async function createNotification(
  tablesDB: TablesDB,
  input: NewNotification,
): Promise<void> {
  const recipientUserId = input.recipientUserId.slice(0, RECIPIENT_MAX)
  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: NOTIFICATIONS_TABLE,
    rowId: ID.unique(),
    data: {
      recipient_user_id: recipientUserId,
      kind: input.kind.slice(0, KIND_MAX),
      title: input.title.slice(0, TITLE_MAX),
      body: (input.body ?? '').slice(0, BODY_MAX),
      entity_ref: (input.entityRef ?? '').slice(0, ENTITY_REF_MAX),
      is_read: false,
      created_at: new Date().toISOString(),
    },
    permissions: [Permission.update(AppwriteRole.user(recipientUserId))],
  })
}

/**
 * Every `users.auth_user_id` whose `roles` includes `system_admin` — one
 * `listRows` call, shared by any caller that needs to fan out to the System
 * Admin team (e.g. a batch of several `notifySystemAdmins` calls in a loop
 * should fetch this list once up front and reuse it, rather than each call
 * re-scanning the `users` table).
 *
 * Reuses `./caller.ts::parseRoles` (the same comma/whitespace-splitting
 * pipeline `requireStaffCaller` reads) instead of re-implementing role-string
 * parsing here (`claude.md` A.2).
 */
export async function listSystemAdminUserIds(tablesDB: TablesDB): Promise<string[]> {
  const found = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: USERS_TABLE,
    queries: [Query.limit(USERS_FETCH_LIMIT)],
  })
  const rows = (found.rows ?? []) as unknown as Record<string, unknown>[]

  const ids: string[] = []
  for (const row of rows) {
    const roles = typeof row.roles === 'string' ? row.roles : undefined
    if (!parseRoles(roles).includes(Role.SystemAdmin)) continue
    const authUserId = String(row.auth_user_id ?? '').trim()
    if (authUserId) ids.push(authUserId)
  }
  return ids
}

/**
 * Fan out one notification to every current System Admin
 * ({@link listSystemAdminUserIds}). This is the only targeting this Story
 * wires up — the fraud scan and force-manual approval triggers both notify
 * the System Admin team; routing to other roles (branch accountant for
 * overdue customers, etc.) is future work per the Implementation Plan's
 * trigger list.
 *
 * Calling this once per item in a loop re-fetches the admin list every time;
 * a caller creating several notifications in one request should call
 * {@link listSystemAdminUserIds} once and `createNotification` directly per
 * (item, admin) pair instead — see `functions/routes/fraud-scan.ts`.
 */
export async function notifySystemAdmins(
  tablesDB: TablesDB,
  input: Omit<NewNotification, 'recipientUserId'>,
): Promise<void> {
  const adminIds = await listSystemAdminUserIds(tablesDB)
  for (const recipientUserId of adminIds) {
    await createNotification(tablesDB, { ...input, recipientUserId })
  }
}
