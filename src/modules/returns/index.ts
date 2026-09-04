/**
 * Public surface of the `returns` module — return requests reversing a sale
 * (`INV-`), a warehouse transfer (`TRF-`) or a raw-material receipt (`SR-`)
 * (`docs/IMPLEMENTATION_PLAN.md` §1 principle 5, §3, Phase 2 Story 2.8).
 *
 * Domain schemas / types here are the source of truth for the `return_requests`
 * row shape (`claude.md` B.2). Admin master-data (`Product`, `Warehouse`, …) is
 * imported from `@/modules/admin`, never re-declared. Never imports
 * `@/modules/sales` or `@/modules/inventory` — a return works off `origin_ref`'s
 * prefix alone, decoupled from where the goods actually came from.
 */

// --- pages --------------------------------------------------------------------
export {
  ReturnsHubPage,
  ReturnRequestListPage,
  ReturnRequestFormPage,
  ReturnRequestDetailPage,
} from './presentation/pages'

// --- routing + nav ---------------------------------------------------------
export { returnsRoutes } from './presentation/routes'
export { returnsNavItems, RETURNS_NAV_ROLES } from './presentation/nav'

// --- data (repositories) ----------------------------------------------------
export { returnRequestsRepo } from './data/repos'
export {
  postReturnToLedger,
  ReturnsVoucherType,
  type ReturnLedgerPostResult,
} from './data/post-return'

// --- domain (schemas, workflow, builders) ---------------------------------
export * from './domain/schemas'
export { originKind, originWarehouseHint, type OriginKind } from './domain/origin'
export { RETURN_TRANSITIONS, canReturnTransition } from './domain/status-flow'
export { returnToStockMoves, type StockMove } from './domain/to-ledger'
