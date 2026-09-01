/**
 * Public surface of the `traceability` module.
 *
 * - `TraceabilityPage` — search a reference id, render its full document chain.
 * - `AuditLogPage` — filterable `audit_log` viewer.
 * - `traceabilityNavItems` — nav entries for the app shell to pick up (Phase 1.5).
 */
import { Role } from '@/core/rbac'

export { TraceabilityPage } from './presentation/pages/TraceabilityPage'
export { AuditLogPage } from './presentation/pages/AuditLogPage'

export { walkChain, linearize } from './domain/chain-walker'
export type { ChainNode, ChainGraph, ChainNodeRef } from './domain/chain-walker'
export { resolveNode, getAuditTrail } from './data/traceability-repo'
export type { AuditRow } from './data/traceability-repo'
export { entityLabel, ENTITY_LABELS } from './domain/entity-labels'

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
