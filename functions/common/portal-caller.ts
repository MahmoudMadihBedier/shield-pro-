/**
 * Resolve the calling user's own customer record from inside a Function, by
 * reading the `customers` row whose `portal_user_id` matches their verified
 * `$id` (Implementation Plan §1 Phase 3). This is the mirror image of
 * `caller.ts::requireStaffCaller`: staff have a `users` profile row and no
 * `customers.portal_user_id`; a portal customer has the opposite. Every
 * customer-facing route in `functions/routes/portal-data.ts` starts here so a
 * customer session can only ever see rows that carry THEIR customer id — the
 * portal never uses a raw `tablesDB` client, only these narrowly-scoped
 * Function routes (see claude.md A.6 / the CRM portal security model).
 */
import { Query, type TablesDB } from 'node-appwrite'
import { z } from 'zod'

import { DATABASE_ID } from './appwrite'
import { FnError } from './handler'

const CUSTOMERS_TABLE = 'customers'

export interface PortalCallerContext {
  customerId: string
  code: string
  name: string
  branchId: string | null
}

/** Defensive parse of the columns this module reads off a `customers` row. */
const customerLookupSchema = z.object({
  code: z.string(),
  name: z.string(),
  branch_id: z.string().optional().nullable(),
})

function firstRow(result: unknown): Record<string, unknown> | null {
  if (typeof result !== 'object' || result === null) return null
  const rows = (result as { rows?: unknown }).rows
  if (!Array.isArray(rows) || rows.length === 0) return null
  const row = rows[0]
  return typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : null
}

/**
 * Look up the `customers` row linked to `callerUserId`. Throws `forbidden`
 * when no customer is linked (an anonymous visitor, a staff account, or a
 * portal Auth user whose link was revoked/never set) — there is no partial
 * access for a portal session.
 */
export async function requireCustomerCaller(
  tablesDB: TablesDB,
  callerUserId: string,
): Promise<PortalCallerContext> {
  const found = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: CUSTOMERS_TABLE,
    queries: [Query.equal('portal_user_id', callerUserId), Query.limit(1)],
  })

  const row = firstRow(found)
  if (!row) {
    throw new FnError('forbidden', 'no portal account is linked to this session')
  }

  const parsed = customerLookupSchema.safeParse(row)
  if (!parsed.success) {
    throw new FnError('server', 'the linked customer record is missing required fields')
  }

  const customerId = typeof row.$id === 'string' ? row.$id : ''
  if (!customerId) {
    throw new FnError('server', 'the linked customer record is missing an id')
  }

  const branchId =
    parsed.data.branch_id && parsed.data.branch_id.trim() !== '' ? parsed.data.branch_id : null

  return { customerId, code: parsed.data.code, name: parsed.data.name, branchId }
}
