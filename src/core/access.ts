/**
 * RBAC + branch-scope decision helpers for the document-lifecycle Functions
 * (Implementation Plan §4.6, Phase 2 Story 2.1).
 *
 * Pure predicates only — the `functions/` layer resolves the caller's identity
 * and maps a `false` here onto `FnError('forbidden', …)`. The UI may consult the
 * same helpers to hide/disable buttons, but enforcement lives server-side.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */
import { Role, hasGlobalScope, type Principal } from './rbac'
import { SUBMITTABLE_DOC_TABLES, type SubmittableDocTable } from './document'

/**
 * May this principal act on a document that belongs to `docBranchId`?
 *   - global-scope roles (System Admin, Chief Accountant, Main Warehouse Manager)
 *     act everywhere;
 *   - a document with no branch (factory / global master data) is in scope for
 *     everyone;
 *   - otherwise the principal must be bound to that exact branch.
 */
export function canActOnBranch(
  principal: Principal,
  docBranchId: string | null | undefined,
): boolean {
  if (hasGlobalScope(principal)) return true
  if (docBranchId == null || docBranchId === '') return true
  return principal.branchId != null && principal.branchId === docBranchId
}

/**
 * Which roles may submit each submittable-document table.
 *
 * FIRST CUT — derived best-effort from the role responsibilities in the plan /
 * `.docx` §2. It is deliberately permissive at the edges and meant to be tuned
 * as the approval matrix firms up (Story 2.2). `SystemAdmin` is always allowed
 * regardless of the entry here (see `canSubmitTable`). A table with no entry
 * falls back to "System Admin only".
 */
export const SUBMIT_ROLE_BY_TABLE: Partial<Record<SubmittableDocTable, readonly Role[]>> = {
  purchase_orders: [Role.PurchasingAccountant, Role.SystemAdmin],
  stock_receipts: [Role.RawStoreKeeper, Role.SystemAdmin],
  production_requests: [Role.FactoryManager, Role.FactoryAccountant, Role.SystemAdmin],
  production_batches: [Role.FactoryManager, Role.FactoryAccountant, Role.SystemAdmin],
  warehouse_transfers: [Role.MainWarehouseManager, Role.SubWarehouseManager, Role.SystemAdmin],
  rep_stock_issues: [Role.SubWarehouseManager, Role.SystemAdmin],
  sales_invoices: [Role.SalesRep, Role.BranchAccountant, Role.SystemAdmin],
  receipts: [Role.SalesRep, Role.BranchAccountant, Role.SystemAdmin],
  payment_vouchers: [Role.BranchAccountant, Role.ChiefAccountant, Role.SystemAdmin],
  return_requests: [Role.BranchAccountant, Role.SystemAdmin],
  write_offs: [Role.MainWarehouseManager, Role.SubWarehouseManager, Role.SystemAdmin],
  stock_count_sessions: [Role.MainWarehouseManager, Role.SubWarehouseManager, Role.SystemAdmin],
  rep_closeouts: [Role.BranchAccountant, Role.SystemAdmin],
}

const ALL_TABLES: ReadonlySet<string> = new Set(SUBMITTABLE_DOC_TABLES)

/**
 * Does any of the caller's `roles` permit submitting / cancelling `table`?
 * `SystemAdmin` always may. An unknown table is denied outright.
 */
export function canSubmitTable(roles: readonly Role[], table: string): boolean {
  if (roles.includes(Role.SystemAdmin)) return true
  if (!ALL_TABLES.has(table)) return false
  const allowed = SUBMIT_ROLE_BY_TABLE[table as SubmittableDocTable]
  if (!allowed) return false
  return roles.some((r) => allowed.includes(r))
}
