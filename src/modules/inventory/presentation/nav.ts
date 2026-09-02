/**
 * Nav metadata for the `inventory` module. Dependency-light (no react / appwrite
 * / pages) so the app shell can import it without pulling the module into the
 * main bundle — the `/inventory/*` route chunks stay code-split.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

/** Roles that see the inventory section (`IMPLEMENTATION_PLAN.md` §3 / §4.6). */
export const INVENTORY_NAV_ROLES: readonly Role[] = [
  Role.MainWarehouseManager,
  Role.SubWarehouseManager,
  Role.MainWarehouseAccountant,
  Role.SystemAdmin,
]

export const inventoryNavItems: readonly NavItem[] = [
  { to: '/inventory', label: 'المخزون', labelEn: 'Inventory', roles: INVENTORY_NAV_ROLES, end: true },
  { to: '/inventory/stock', label: 'الرصيد الحالي', labelEn: 'Stock on hand', roles: INVENTORY_NAV_ROLES },
  { to: '/inventory/transfers', label: 'التحويلات', labelEn: 'Transfers', roles: INVENTORY_NAV_ROLES },
  { to: '/inventory/counts', label: 'الجرد', labelEn: 'Stock counts', roles: INVENTORY_NAV_ROLES },
  { to: '/inventory/write-offs', label: 'الهالك', labelEn: 'Write-offs', roles: INVENTORY_NAV_ROLES },
]
