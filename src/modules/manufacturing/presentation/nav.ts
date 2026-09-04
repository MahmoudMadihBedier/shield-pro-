/**
 * Nav metadata for the `manufacturing` module. Dependency-light (no react / data
 * layer / pages) so the app shell can import it without pulling the module's
 * route chunks into the main bundle.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

const MANUFACTURING_ROLES = [
  Role.FactoryManager,
  Role.FactoryAccountant,
  Role.SystemAdmin,
] as const

export const manufacturingNavItems: NavItem[] = [
  {
    to: '/manufacturing',
    label: 'التصنيع',
    labelEn: 'Manufacturing',
    roles: MANUFACTURING_ROLES,
    end: true,
  },
  {
    to: '/manufacturing/requests',
    label: 'طلبات الإنتاج',
    labelEn: 'Production requests',
    roles: MANUFACTURING_ROLES,
  },
  {
    to: '/manufacturing/batches',
    label: 'أوامر التشغيل',
    labelEn: 'Production batches',
    roles: MANUFACTURING_ROLES,
  },
]
