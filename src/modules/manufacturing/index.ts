/**
 * Public surface of the `manufacturing` module (Phase 2 — production requests &
 * batches).
 *
 * - Pages + `manufacturingRoutes` (wired into the app shell router).
 * - `manufacturingNavItems` for the primary nav.
 * - The two document repos + the batch → stock-ledger poster for the data layer.
 * - Domain schemas / types / state-machine helpers for any downstream module.
 */

// --- pages --------------------------------------------------------------------
export { ManufacturingHubPage } from './presentation/pages/ManufacturingHubPage'
export { ProductionRequestListPage } from './presentation/pages/ProductionRequestListPage'
export { ProductionRequestFormPage } from './presentation/pages/ProductionRequestFormPage'
export { ProductionRequestDetailPage } from './presentation/pages/ProductionRequestDetailPage'
export { ProductionBatchListPage } from './presentation/pages/ProductionBatchListPage'
export { ProductionBatchFormPage } from './presentation/pages/ProductionBatchFormPage'
export { ProductionBatchDetailPage } from './presentation/pages/ProductionBatchDetailPage'

// --- routing + nav ----------------------------------------------------------
export { manufacturingRoutes } from './presentation/routes'
export { manufacturingNavItems } from './presentation/nav'

// --- data (repositories + ledger posting) ---------------------------------
export { productionRequestsRepo, productionBatchesRepo } from './data/repos'
export {
  postBatchToLedger,
  isAlreadyPosted,
  type BatchLedgerWarehouseIds,
} from './data/post-batch'

// --- domain (schemas, types, state machines) -----------------------------
export {
  PRODUCTION_REQUEST_STATUSES,
  QC_STATUSES,
  productionRequestRowSchema,
  productionRequestDraftSchema,
  productionBatchRowSchema,
  productionBatchDraftSchema,
  requiredMaterialLineSchema,
  rawMaterialLotSchema,
  type ProductionRequest,
  type ProductionRequestDraft,
  type ProductionRequestStatus,
  type ProductionBatch,
  type ProductionBatchDraft,
  type QcStatus,
  type RequiredMaterialLine,
  type RawMaterialLot,
} from './domain/schemas'
export {
  requiredMaterialsFor,
  serializeRequiredMaterials,
  parseRequiredMaterials,
  serializeRawMaterialLots,
  parseRawMaterialLots,
} from './domain/planning'
export { expectedCost, expectedProfit, wasteRatio, wasteWithinAllowance } from './domain/costing'
export { QC_TRANSITIONS, canQcTransition, isTransferable } from './domain/qc'
export { REQUEST_TRANSITIONS, canRequestTransition } from './domain/request-status'
export {
  batchToStockMoves,
  type StockMove,
  type BatchForLedger,
  type BatchLedgerWarehouses,
} from './domain/to-ledger'
