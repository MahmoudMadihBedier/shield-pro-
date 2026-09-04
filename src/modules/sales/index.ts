/**
 * Public surface of the `sales` module — sales invoices, rep stock issues and
 * the rep daily close-out (`IMPLEMENTATION_PLAN.md` Phase 2, esp. Story 2.4).
 *
 * Domain schemas / types here are the source of truth for these row shapes
 * (`claude.md` B.2). Master data (`Customer`, `Product`, …) is imported from
 * `@/modules/admin`, never re-declared.
 *
 * NB: the app shell imports the leaf `./presentation/routes` and
 * `./presentation/nav` directly (not this barrel) so the `/sales/*` chunks stay
 * code-split.
 */

// --- pages ------------------------------------------------------------------
export {
  SalesHubPage,
  SalesInvoiceListPage,
  SalesInvoiceFormPage,
  SalesInvoiceDetailPage,
  RepStockIssueListPage,
  RepStockIssueFormPage,
  RepStockIssueDetailPage,
  RepCloseoutListPage,
  RepCloseoutPage,
} from './presentation/pages'

// --- routing + nav --------------------------------------------------------
export { salesRoutes } from './presentation/routes'
export { salesNavItems, SALES_NAV_ROLES } from './presentation/nav'

// --- data (repositories) --------------------------------------------------
export { salesInvoicesRepo, repStockIssuesRepo, repCloseoutsRepo } from './data/repos'
export {
  listRepStockLedger,
  listRepCashLedger,
  repStockBalance,
  repCashBalance,
  type LedgerPage,
  type RepStockLedgerParams,
  type RepCashLedgerParams,
  type RepStockBalanceRow,
  type RepCashBalanceRow,
} from './data/rep-ledgers-repo'
export {
  postInvoiceToLedger,
  postRepIssueToLedger,
  type InvoiceLedgerPosting,
  type RepIssueLedgerPosting,
  type RepIssueWarehouses,
} from './data/post-sales'

// --- domain (schemas, pricing, geo, close-out, ledger builders) ----------
export * from './domain/schemas'
export {
  lineNet,
  priceInvoiceLine,
  invoiceTotals,
  splitPayment,
  type PricebookProduct,
  type InvoiceTotals,
  type PaymentSplit,
} from './domain/pricing'
export { parseGeo, isValidGeo, type GeoPoint } from './domain/geo'
export {
  reconcileCloseout,
  custodyIdentity,
  closeoutOutcomeStatus,
  CLOSEOUT_EPSILON,
  type CloseoutReconciliation,
} from './domain/closeout'
export {
  invoiceToStockMoves,
  invoiceToGlLines,
  repIssueToStockMoves,
  SALES_ACCOUNTS,
  type StockMove,
} from './domain/to-ledger'
export {
  canActOnSales,
  canManageSales,
  SALES_ACTOR_ROLES,
  SALES_MANAGER_ROLES,
} from './domain/permissions'
