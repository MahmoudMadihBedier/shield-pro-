/**
 * Nav metadata for the `fraud` module. Dependency-light (no react / appwrite /
 * pages) so the app shell can import it without pulling the module into the
 * main bundle — the `/fraud` route chunk stays code-split.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

/** Fraud review is a chief-accountant / system-admin concern. */
export const FRAUD_NAV_ROLES: readonly Role[] = [Role.SystemAdmin, Role.ChiefAccountant]

export const fraudNavItems: readonly NavItem[] = [
  {
    to: '/fraud',
    label: 'كشف الاحتيال',
    labelEn: 'Fraud detection',
    roles: FRAUD_NAV_ROLES,
    end: true,
  },
]
