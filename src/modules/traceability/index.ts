/**
 * Public surface of the `traceability` module.
 *
 * - `TraceabilityPage` — search a reference id, render its full document chain.
 * - `AuditLogPage` — filterable `audit_log` viewer.
 * - `traceabilityNavItems` — nav entries for the app shell to pick up (Phase 1.5).
 */
export { TraceabilityPage } from './presentation/pages/TraceabilityPage'
export { AuditLogPage } from './presentation/pages/AuditLogPage'

export { walkChain, linearize } from './domain/chain-walker'
export type { ChainNode, ChainGraph, ChainNodeRef } from './domain/chain-walker'
export { resolveNode, getAuditTrail } from './data/traceability-repo'
export type { AuditRow } from './data/traceability-repo'
export { entityLabel, ENTITY_LABELS } from './domain/entity-labels'

// Re-exported from the dependency-light `./nav` (keeps route chunks split).
export { traceabilityNavItems, type TraceabilityNavItem } from './nav'
