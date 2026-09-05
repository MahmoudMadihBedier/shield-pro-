/**
 * Nav metadata for the `reports` module. Dependency-light (no react / data
 * layer) so the app shell can import it without pulling the module into the
 * main bundle — the `/reports` route chunk stays code-split.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

/**
 * Broad visibility for a KPI dashboard — every widget reads data any of these
 * roles can already read per the existing table permissions; this only gates
 * the nav *entry point* (`claude.md` A.6: real enforcement is server-side).
 */
export const REPORTS_NAV_ROLES: readonly Role[] = [
  Role.SystemAdmin,
  Role.ChiefAccountant,
  Role.MainWarehouseManager,
]

export const reportsNavItems: readonly NavItem[] = [
  {
    to: '/reports',
    label: 'التقارير',
    labelEn: 'Reports',
    roles: REPORTS_NAV_ROLES,
    end: true,
  },
]
