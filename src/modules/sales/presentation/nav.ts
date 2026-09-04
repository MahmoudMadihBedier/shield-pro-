/**
 * Nav metadata for the `sales` module. Dependency-light (no react / data layer /
 * pages) so the app shell can import it without pulling the module into the main
 * bundle — the `/sales/*` route chunks stay code-split.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

/** Roles that see the sales section (`IMPLEMENTATION_PLAN.md` §3 — scoped visibility). */
export const SALES_NAV_ROLES: readonly Role[] = [
  Role.SalesRep,
  Role.BranchAccountant,
  Role.ChiefAccountant,
  Role.SystemAdmin,
]

export const salesNavItems: readonly NavItem[] = [
  { to: '/sales', label: 'المبيعات', labelEn: 'Sales', roles: SALES_NAV_ROLES, end: true },
  { to: '/sales/invoices', label: 'الفواتير', labelEn: 'Invoices', roles: SALES_NAV_ROLES },
  {
    to: '/sales/rep-issues',
    label: 'صرف عهدة المندوب',
    labelEn: 'Rep stock issues',
    roles: SALES_NAV_ROLES,
  },
  {
    to: '/sales/closeouts',
    label: 'تقفيل المندوب اليومي',
    labelEn: 'Rep close-out',
    roles: SALES_NAV_ROLES,
  },
]
