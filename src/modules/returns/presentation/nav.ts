/**
 * Nav metadata for the `returns` module. Dependency-light (no react / appwrite
 * / pages) so the app shell can import it without pulling the module into the
 * main bundle — the `/returns/*` route chunks stay code-split.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

/** Roles that see the returns section (`src/core/access.ts::SUBMIT_ROLE_BY_TABLE['return_requests']`). */
export const RETURNS_NAV_ROLES: readonly Role[] = [Role.BranchAccountant, Role.SystemAdmin]

export const returnsNavItems: readonly NavItem[] = [
  { to: '/returns', label: 'المرتجعات', labelEn: 'Returns', roles: RETURNS_NAV_ROLES, end: true },
  {
    to: '/returns/requests',
    label: 'طلبات المرتجعات',
    labelEn: 'Return requests',
    roles: RETURNS_NAV_ROLES,
  },
]
