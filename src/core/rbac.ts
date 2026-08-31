/**
 * Roles and the branch-scoped visibility model, taken directly from
 * `نظام_ادارة_الانتاج_والتوزيع_والمبيعات.docx` §2 and §9, and cross-checked
 * against ERPNext's Role + User Permission model.
 *
 * The UI uses these to hide/disable actions a role cannot perform. Real
 * enforcement happens server-side in Appwrite Functions + collection
 * permissions — never in the UI alone (`claude.md` A.6).
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

export const Role = {
  /** مسؤول النظام الرئيسي — owner / god-mode. */
  SystemAdmin: 'system_admin',
  /** مسؤول المصنع */
  FactoryManager: 'factory_manager',
  /** مسؤول مخزن المشتريات (أمين مخزن الخامات) */
  RawStoreKeeper: 'raw_store_keeper',
  /** مسؤول المخزن الرئيسي (المنتج التام) */
  MainWarehouseManager: 'main_warehouse_manager',
  /** مسؤول المخزن الفرعي — scoped to one branch */
  SubWarehouseManager: 'sub_warehouse_manager',
  /** مندوب المبيعات — scoped to one branch + sub-warehouse */
  SalesRep: 'sales_rep',
  /** محاسب الفرع — scoped to one branch */
  BranchAccountant: 'branch_accountant',
  /** محاسب المصنع */
  FactoryAccountant: 'factory_accountant',
  /** محاسب مخزن المشتريات */
  PurchasingAccountant: 'purchasing_accountant',
  /** محاسب المخزن الرئيسي */
  MainWarehouseAccountant: 'main_warehouse_accountant',
  /** المحاسب الرئيسي — sees every branch */
  ChiefAccountant: 'chief_accountant',
} as const

export type Role = (typeof Role)[keyof typeof Role]

/** Roles that see every branch and the factory (no scope filter applied). */
export const GLOBAL_SCOPE_ROLES: ReadonlySet<Role> = new Set<Role>([
  Role.SystemAdmin,
  Role.ChiefAccountant,
  Role.MainWarehouseManager,
])

/** Roles pinned to exactly one branch. */
export const BRANCH_SCOPED_ROLES: ReadonlySet<Role> = new Set<Role>([
  Role.SubWarehouseManager,
  Role.SalesRep,
  Role.BranchAccountant,
])

export interface Principal {
  userId: string
  roles: readonly Role[]
  /** Branch the user is bound to, if any. Set exclusively by the System Admin. */
  branchId?: string | null
}

export function hasRole(principal: Principal, role: Role): boolean {
  return principal.roles.includes(role)
}

export function isSystemAdmin(principal: Principal): boolean {
  return hasRole(principal, Role.SystemAdmin)
}

export function hasGlobalScope(principal: Principal): boolean {
  return principal.roles.some((r) => GLOBAL_SCOPE_ROLES.has(r))
}

/** Can this principal see records belonging to `branchId`? */
export function canSeeBranch(principal: Principal, branchId: string): boolean {
  if (hasGlobalScope(principal)) return true
  return principal.branchId != null && principal.branchId === branchId
}
