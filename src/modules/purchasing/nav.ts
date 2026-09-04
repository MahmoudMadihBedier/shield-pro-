/**
 * Nav metadata for the `purchasing` module. Dependency-light (no react / data
 * layer) so the app shell can import it without pulling the module into the
 * main bundle — the `/purchasing/*` route chunks stay code-split.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

const PURCHASING_ROLES = [Role.PurchasingAccountant, Role.RawStoreKeeper, Role.SystemAdmin] as const

export const purchasingNavItems: readonly NavItem[] = [
  {
    to: '/purchasing',
    label: 'المشتريات',
    labelEn: 'Purchasing',
    roles: PURCHASING_ROLES,
    end: true,
  },
  {
    to: '/purchasing/orders',
    label: 'أوامر الشراء',
    labelEn: 'Purchase orders',
    roles: PURCHASING_ROLES,
  },
  {
    to: '/purchasing/receipts',
    label: 'استلام الخامات',
    labelEn: 'Raw-material receipts',
    roles: PURCHASING_ROLES,
  },
]
