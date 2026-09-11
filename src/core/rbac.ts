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

/** Every role slug, in a sensible presentation order. */
export const ALL_ROLES: readonly Role[] = [
  Role.SystemAdmin,
  Role.ChiefAccountant,
  Role.FactoryManager,
  Role.MainWarehouseManager,
  Role.SubWarehouseManager,
  Role.SalesRep,
  Role.RawStoreKeeper,
  Role.BranchAccountant,
  Role.FactoryAccountant,
  Role.PurchasingAccountant,
  Role.MainWarehouseAccountant,
]

/** Bilingual job-title label per role. */
export const ROLE_LABELS: Record<Role, { ar: string; en: string }> = {
  [Role.SystemAdmin]: { ar: 'مسؤول النظام الرئيسي', en: 'System Admin' },
  [Role.FactoryManager]: { ar: 'مسؤول المصنع', en: 'Factory Manager' },
  [Role.RawStoreKeeper]: { ar: 'أمين مخزن الخامات', en: 'Raw Store Keeper' },
  [Role.MainWarehouseManager]: { ar: 'مسؤول المخزن الرئيسي', en: 'Main Warehouse Manager' },
  [Role.SubWarehouseManager]: { ar: 'مسؤول المخزن الفرعي', en: 'Sub-Warehouse Manager' },
  [Role.SalesRep]: { ar: 'مندوب المبيعات', en: 'Sales Rep' },
  [Role.BranchAccountant]: { ar: 'محاسب الفرع', en: 'Branch Accountant' },
  [Role.FactoryAccountant]: { ar: 'محاسب المصنع', en: 'Factory Accountant' },
  [Role.PurchasingAccountant]: { ar: 'محاسب المشتريات', en: 'Purchasing Accountant' },
  [Role.MainWarehouseAccountant]: {
    ar: 'محاسب المخزن الرئيسي',
    en: 'Main Warehouse Accountant',
  },
  [Role.ChiefAccountant]: { ar: 'المحاسب الرئيسي', en: 'Chief Accountant' },
}

/** `{ value, label }[]` for a roles picker. */
export const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = ALL_ROLES.map((r) => ({
  value: r,
  label: `${ROLE_LABELS[r].ar} / ${ROLE_LABELS[r].en}`,
}))

/** Parse the space/comma-separated `users.roles` slug string into a role list. */
export function parseRoles(raw: string | null | undefined): Role[] {
  if (!raw) return []
  const known = new Set<string>(ALL_ROLES)
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s): s is Role => known.has(s))
}

/** Serialise a role list back to the space-separated slug string. */
export function serializeRoles(roles: readonly Role[]): string {
  return [...new Set(roles)].join(' ')
}

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

/**
 * `true` when `principal` is the System Admin, or `principal.userId` matches
 * one of `ownerIds` (e.g. a row's `created_by` and/or `assigned_to`) — the
 * "may I manage this row" check repeated across every module that lets a
 * creator/assignee self-serve without an approval workflow (CRM activities,
 * follow-ups, leads, …). `principal` may be `null` (anonymous / still
 * loading), which is always `false`.
 */
export function isOwnerOrAdmin(
  principal: Principal | null | undefined,
  ...ownerIds: ReadonlyArray<string | null | undefined>
): boolean {
  if (principal == null) return false
  if (isSystemAdmin(principal)) return true
  return ownerIds.some((id) => id != null && id === principal.userId)
}

/** Can this principal see records belonging to `branchId`? */
export function canSeeBranch(principal: Principal, branchId: string): boolean {
  if (hasGlobalScope(principal)) return true
  return principal.branchId != null && principal.branchId === branchId
}
