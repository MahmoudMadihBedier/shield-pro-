/**
 * Admin-triggered lifecycle for a customer's CRM portal Auth account
 * (Implementation Plan §1 Phase 3, Story 3.1 create + 3.3 link/manage).
 *
 * The portal's password IS the PIN — Appwrite owns hashing, rate-limiting and
 * session management. Shield Pro never persists a PIN: it is generated here,
 * handed to `Users.create` / `Users.updatePassword` and returned to the
 * calling admin exactly once in the response. It is never written to
 * `audit_log` or any table.
 *
 * NOT wrapped in `runInTransaction`: `node-appwrite` DB transactions cover
 * `TablesDB` row operations only — `Users.create` / `updatePassword` /
 * `updateStatus` / `deleteSessions` are Auth API calls outside that scope, so
 * wrapping these routes in one would give a false sense of atomicity (the
 * transaction can only cover the `customers` row write, never the Auth
 * call). Each route instead performs its Auth call first and its single
 * `TablesDB` write second, in an order that is safe to retry: `create`
 * rejects outright if `portal_user_id` is already set, and `reset` /
 * `revoke` only ever re-apply an idempotent Auth change.
 */
import { randomInt } from 'node:crypto'

import { ID, type TablesDB } from 'node-appwrite'
import { z } from 'zod'

import { portalEmailForCode } from '@/core/portal'
import { Role } from '@/core/rbac'
import { DATABASE_ID } from '../common/appwrite'
import { appendAudit } from '../common/audit'
import { requireStaffCaller } from '../common/caller'
import { FnError } from '../common/handler'

const CUSTOMERS_TABLE = 'customers'

/** Roles allowed to create/reset/revoke a customer's portal account. `SystemAdmin` is implicit via this list. */
const PORTAL_ADMIN_ROLES: readonly Role[] = [Role.SystemAdmin, Role.BranchAccountant, Role.ChiefAccountant]

/**
 * The narrow slice of `node-appwrite`'s `Users` service these routes depend
 * on, injected so they're unit-testable without a real Appwrite client. The
 * real `node-appwrite` `Users` instance (built by
 * `functions/common/appwrite.ts::usersServiceFromRequest`) satisfies this
 * structurally — its object-param overloads match exactly.
 */
export interface UsersApi {
  create(params: {
    userId: string
    email: string
    password: string
    name?: string
  }): Promise<{ $id: string }>
  updatePassword(params: { userId: string; password: string }): Promise<unknown>
  updateStatus(params: { userId: string; status: boolean }): Promise<unknown>
  deleteSessions(params: { userId: string }): Promise<unknown>
}

const customerLookupSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  portal_user_id: z.string().optional().nullable(),
})

interface LoadedCustomer {
  id: string
  code: string
  name: string
  portalUserId: string | null
}

function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404
}

/** An 8-digit PIN, cryptographically random (`node:crypto`'s `randomInt`). */
function generatePin(): string {
  return String(randomInt(10_000_000, 100_000_000))
}

async function loadCustomer(tablesDB: TablesDB, customerId: string): Promise<LoadedCustomer> {
  let row: Record<string, unknown>
  try {
    row = (await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: CUSTOMERS_TABLE,
      rowId: customerId,
    })) as unknown as Record<string, unknown>
  } catch (e) {
    if (isNotFound(e)) throw new FnError('not_found', `customer ${customerId} does not exist`)
    throw e
  }

  const parsed = customerLookupSchema.safeParse(row)
  if (!parsed.success) {
    throw new FnError('server', `customer ${customerId} is missing required fields`)
  }

  const id = typeof row.$id === 'string' ? row.$id : customerId
  const portalUserId =
    parsed.data.portal_user_id && parsed.data.portal_user_id.trim() !== ''
      ? parsed.data.portal_user_id
      : null

  return { id, code: parsed.data.code, name: parsed.data.name, portalUserId }
}

/** Gate: signed-in staff whose role manages CRM portal accounts. */
async function requirePortalAdmin(tablesDB: TablesDB, caller: string | null): Promise<void> {
  if (!caller) throw new FnError('unauthorized', 'a signed-in staff caller is required')
  const callerCtx = await requireStaffCaller(tablesDB, caller)
  if (!callerCtx.roles.some((r) => PORTAL_ADMIN_ROLES.includes(r))) {
    throw new FnError('forbidden', 'your role may not manage CRM portal accounts')
  }
}

// ---------------------------------------------------------------------------
// createPortalAccount
// ---------------------------------------------------------------------------

export interface CreatePortalAccountInput {
  customerId: string
}

export interface CreatePortalAccountOutput {
  portalUserId: string
  pin: string
}

export async function createPortalAccount(
  tablesDB: TablesDB,
  usersApi: UsersApi,
  input: CreatePortalAccountInput,
  caller: string | null,
): Promise<CreatePortalAccountOutput> {
  const customerId = String(input?.customerId ?? '')
  await requirePortalAdmin(tablesDB, caller)
  if (!customerId) throw new FnError('validation', 'customerId is required')

  const customer = await loadCustomer(tablesDB, customerId)
  if (customer.portalUserId) {
    throw new FnError(
      'conflict',
      'this customer already has a portal account — use reset instead',
    )
  }

  const pin = generatePin()
  const created = await usersApi.create({
    userId: ID.unique(),
    email: portalEmailForCode(customer.code),
    password: pin,
    name: customer.name,
  })

  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: CUSTOMERS_TABLE,
    rowId: customer.id,
    data: { portal_user_id: created.$id },
  })

  await appendAudit(tablesDB, {
    actorId: caller,
    action: 'create_portal_account',
    entityType: CUSTOMERS_TABLE,
    entityRef: customer.code,
    after: { portalUserId: created.$id },
  })

  return { portalUserId: created.$id, pin }
}

// ---------------------------------------------------------------------------
// resetPortalPin
// ---------------------------------------------------------------------------

export interface ResetPortalPinInput {
  customerId: string
}

export interface ResetPortalPinOutput {
  pin: string
}

export async function resetPortalPin(
  tablesDB: TablesDB,
  usersApi: UsersApi,
  input: ResetPortalPinInput,
  caller: string | null,
): Promise<ResetPortalPinOutput> {
  const customerId = String(input?.customerId ?? '')
  await requirePortalAdmin(tablesDB, caller)
  if (!customerId) throw new FnError('validation', 'customerId is required')

  const customer = await loadCustomer(tablesDB, customerId)
  if (!customer.portalUserId) {
    throw new FnError('validation', 'this customer has no portal account — create one first')
  }

  const pin = generatePin()
  await usersApi.updatePassword({ userId: customer.portalUserId, password: pin })

  await appendAudit(tablesDB, {
    actorId: caller,
    action: 'reset_portal_pin',
    entityType: CUSTOMERS_TABLE,
    entityRef: customer.code,
    after: { portalUserId: customer.portalUserId },
  })

  return { pin }
}

// ---------------------------------------------------------------------------
// revokePortalAccess
// ---------------------------------------------------------------------------

export interface RevokePortalAccessInput {
  customerId: string
}

export interface RevokePortalAccessOutput {
  revoked: true
}

export async function revokePortalAccess(
  tablesDB: TablesDB,
  usersApi: UsersApi,
  input: RevokePortalAccessInput,
  caller: string | null,
): Promise<RevokePortalAccessOutput> {
  const customerId = String(input?.customerId ?? '')
  await requirePortalAdmin(tablesDB, caller)
  if (!customerId) throw new FnError('validation', 'customerId is required')

  const customer = await loadCustomer(tablesDB, customerId)
  if (!customer.portalUserId) {
    throw new FnError('validation', 'this customer has no portal account to revoke')
  }

  // Blocks future logins AND kills any live session (Story 3.2 revocation).
  await usersApi.updateStatus({ userId: customer.portalUserId, status: false })
  await usersApi.deleteSessions({ userId: customer.portalUserId })

  await appendAudit(tablesDB, {
    actorId: caller,
    action: 'revoke_portal_access',
    entityType: CUSTOMERS_TABLE,
    entityRef: customer.code,
    after: { portalUserId: customer.portalUserId },
  })

  return { revoked: true }
}
