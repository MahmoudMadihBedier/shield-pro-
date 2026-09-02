/**
 * Public surface of the `inventory` module — warehouse transfers, stock-count
 * sessions, write-offs, and the read-only `bin_balances` stock-on-hand view.
 *
 * Domain schemas / types here are the source of truth for these row shapes
 * (`claude.md` B.2). Admin master-data (`Product`, `Warehouse`, …) is imported
 * from `@/modules/admin`, never re-declared.
 */

// --- pages --------------------------------------------------------------------
export {
  InventoryHubPage,
  StockOnHandPage,
  WarehouseTransferListPage,
  WarehouseTransferFormPage,
  WarehouseTransferDetailPage,
  StockCountSessionListPage,
  StockCountSessionPage,
  WriteOffListPage,
  WriteOffFormPage,
  WriteOffDetailPage,
} from './presentation/pages'

// --- routing + nav ---------------------------------------------------------
export { inventoryRoutes } from './presentation/routes'
export { inventoryNavItems, INVENTORY_NAV_ROLES } from './presentation/nav'

// --- data (repositories) ----------------------------------------------------
export {
  warehouseTransfersRepo,
  stockCountSessionsRepo,
  writeOffsRepo,
} from './data/document-repos'
export {
  listBinBalances,
  getBinQty,
  type BinBalanceListParams,
  type BinBalanceListPage,
} from './data/bin-balances-repo'
export {
  postTransferToLedger,
  postWriteOffToLedger,
  postCountAdjustmentToLedger,
  InventoryVoucherType,
  type LedgerPostResult,
} from './data/post-movement'

// --- domain (schemas, workflow, builders) ---------------------------------
export * from './domain/schemas'
export {
  TRANSFER_TRANSITIONS,
  canTransferTransition,
  nextActor,
  type TransferActor,
} from './domain/transfer-flow'
export {
  computeVariances,
  hasVariance,
  parseCounts,
  parseVariances,
  serializeCounts,
  serializeVariances,
} from './domain/variance'
export {
  transferToStockMoves,
  writeOffToStockMoves,
  countAdjustmentToStockMoves,
  type StockMove,
} from './domain/to-ledger'
export { parseLines, serializeLines } from './domain/line-utils'
