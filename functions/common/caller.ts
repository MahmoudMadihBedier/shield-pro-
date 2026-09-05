/**
 * Resolve the calling user's Shield Pro roles + branch binding from inside a
 * Function, by reading their `users` profile row (Implementation Plan §4.6).
 *
 * The client can be trusted for *identity* only — Appwrite injects the verified
 * caller `$id` as `x-appwrite-user-id`. Roles and branch are read here, server
 * side, from the profile table the System Admin controls; they are never taken
 * from the request body.
 *
 * The pure RBAC predicates live in `src/core/access.ts` — this module is the
 * thin data adapter that feeds them.
 */
import { Query, type TablesDB } from 'node-appwrite'
import { z } from 'zod'

import { rolesFromTeamIds } from '@/core/principal'
import type { Role } from '@/core/rbac'
import { DATABASE_ID } from './appwrite'
import { FnError } from './handler'

const USERS_TABLE = 'users'

export interface CallerContext {
  userId: string
  roles: Role[]
  branchId: string | null
}

/**
 * The two profile columns this module reads. Parsed defensively — an Appwrite
 * row is an untyped `Record` and a hand-edited `roles` string can be anything.
 */
const profileSchema = z.object({
  roles: z.string().optional().nullable(),
  branch_id: z.string().optional().nullable(),
})

/** `roles` is a single short string: comma / whitespace separated role slugs.
 *  Exported so other Functions (e.g. `./notifications.ts`) share this exact
 *  parsing instead of re-implementing it. */
export function parseRoles(raw: string | null | undefined): Role[] {
  if (!raw) return []
  const slugs = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return rolesFromTeamIds(slugs)
}

function firstRow(result: unknown): Record<string, unknown> | null {
  if (typeof result !== 'object' || result === null) return null
  const rows = (result as { rows?: unknown }).rows
  if (!Array.isArray(rows) || rows.length === 0) return null
  const row = rows[0]
  return typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : null
}

/**
 * Look up `callerUserId` in the `users` profile table and return their roles +
 * branch. A caller with no profile row gets `{ roles: [], branchId: null }` —
 * the route then denies any non-global action.
 */
export async function loadCallerContext(
  tablesDB: TablesDB,
  callerUserId: string,
): Promise<CallerContext> {
  const found = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: USERS_TABLE,
    queries: [Query.equal('auth_user_id', callerUserId), Query.limit(1)],
  })

  const row = firstRow(found)
  if (!row) return { userId: callerUserId, roles: [], branchId: null }

  const parsed = profileSchema.safeParse(row)
  const profile = parsed.success ? parsed.data : {}
  const branchId = profile.branch_id && profile.branch_id.trim() !== '' ? profile.branch_id : null

  return { userId: callerUserId, roles: parseRoles(profile.roles), branchId }
}

/**
 * Gate a route to staff only. A `users` profile row with at least one role IS
 * "staff" — a CRM portal account (Appwrite Auth user with no `users` row) has
 * none and is denied. Every route that isn't explicitly customer-facing must
 * call this before touching a table a customer session could otherwise reach
 * via `execute: users` on the Function (segregation-guard, allocate-
 * reference-id, post-stock-ledger, post-gl). `submit-document` / `cancel-
 * document` get the equivalent check for free from `canSubmitTable`, which
 * denies an empty role list for every table.
 */
export async function requireStaffCaller(
  tablesDB: TablesDB,
  callerUserId: string,
): Promise<CallerContext> {
  const ctx = await loadCallerContext(tablesDB, callerUserId)
  if (ctx.roles.length === 0) {
    throw new FnError('forbidden', 'this action is restricted to staff accounts')
  }
  return ctx
}
