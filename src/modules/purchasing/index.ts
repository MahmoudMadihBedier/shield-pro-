/**
 * Public surface of the `purchasing` module (supply half of the loop:
 * purchase order → raw-material receipt → stock-ledger posting).
 */
// --- pages --------------------------------------------------------------
export { PurchasingHomePage } from './presentation/pages/PurchasingHomePage'
export { PurchaseOrderListPage } from './presentation/pages/PurchaseOrderListPage'
export { PurchaseOrderFormPage } from './presentation/pages/PurchaseOrderFormPage'
export { PurchaseOrderDetailPage } from './presentation/pages/PurchaseOrderDetailPage'
export { StockReceiptListPage } from './presentation/pages/StockReceiptListPage'
export { StockReceiptFormPage } from './presentation/pages/StockReceiptFormPage'
export { StockReceiptDetailPage } from './presentation/pages/StockReceiptDetailPage'

// --- routing + nav ----------------------------------------------------
export { purchasingRoutes } from './routes'
export { purchasingNavItems } from './nav'

// --- data (repositories + ledger posting) ---------------------------
export { purchaseOrdersRepo, stockReceiptsRepo } from './data/repos'
export { postReceiptToLedger, type ReceiptLedgerPosting } from './data/post-receipt'

// --- domain (schemas + helpers other modules may want) --------------
export {
  poLineSchema,
  receiptLineSchema,
  purchaseOrderRowSchema,
  purchaseOrderDraftSchema,
  purchaseOrderFormSchema,
  stockReceiptRowSchema,
  stockReceiptDraftSchema,
  stockReceiptFormSchema,
  type PurchaseOrder,
  type PurchaseOrderDraft,
  type PurchaseOrderForm,
  type PoLine,
  type StockReceipt,
  type StockReceiptDraft,
  type StockReceiptForm,
  type ReceiptLine,
} from './domain/schemas'
export {
  parseLines,
  serializeLines,
  parsePoLines,
  parseReceiptLines,
  poTotal,
  receivedVsOrdered,
  type MaterialProgress,
  type ReceivedVsOrdered,
} from './domain/lines'
export { receiptToStockMoves, type StockMove } from './domain/to-ledger'
export { canActOnPurchasing, PURCHASING_ACTOR_ROLES } from './domain/permissions'
