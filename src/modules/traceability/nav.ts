/**
 * Nav metadata for the `traceability` module. Dependency-light (no react / data
 * layer) so the app shell can import it without pulling the module into the
 * main bundle.
 */
import { Role } from '@/core/rbac'

export interface TraceabilityNavItem {
  to: string
  labelAr: string
  labelEn: string
  roles?: readonly Role[]
}

export const traceabilityNavItems: readonly TraceabilityNavItem[] = [
  { to: '/traceability', labelAr: 'تتبع المستندات', labelEn: 'Traceability' },
  {
    to: '/audit-log',
    labelAr: 'سجل التدقيق',
    labelEn: 'Audit log',
    roles: [Role.SystemAdmin, Role.ChiefAccountant],
  },
]
