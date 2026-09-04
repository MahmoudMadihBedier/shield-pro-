/**
 * Public surface of the `accounting` module — collections (`receipts`),
 * payment vouchers, the read-only general ledger, the trial balance, and the
 * customer credit / aging model.
 *
 * The credit + aging domain (`creditCheck`, `customerAging`, `AGING_BUCKETS`)
 * is the single source of those rules — `@/modules/sales` and `@/modules/admin`
 * import them from here rather than re-implementing.
 */

// --- pages ----------------------------------------------------------------
export {
  AccountingHubPage,
  ReceiptListPage,
  ReceiptFormPage,
  ReceiptDetailPage,
  PaymentVoucherListPage,
  PaymentVoucherFormPage,
  PaymentVoucherDetailPage,
  CustomerAgingPage,
  TrialBalancePage,
  GeneralLedgerPage,
} from './presentation/pages'

// --- routing + nav ------------------------------------------------------
export { accountingRoutes } from './presentation/routes'
export { accountingNavItems, ACCOUNTING_NAV_ROLES } from './presentation/nav'

// --- data (repositories) ----------------------------------------------------
export { receiptsRepo, paymentVouchersRepo } from './data/repos'
export {
  listGlEntries,
  accountBalance,
  trialBalanceRows,
  type GlEntryListParams,
  type GlEntryListPage,
} from './data/gl-repo'
export {
  listSubmittedInvoices,
  listReceiptsForCustomer,
  customerAgingReport,
  type CustomerAgingRow,
} from './data/aging-repo'
export { postReceiptToGl, postVoucherToGl, type GlPosting } from './data/post-accounting'

// --- domain (schemas, credit + aging model, GL math) --------------------
export {
  RECEIPT_METHODS,
  VOUCHER_DIRECTIONS,
  INVOICE_PAYMENT_METHODS,
  receiptMethodSchema,
  voucherDirectionSchema,
  receiptRowSchema,
  receiptDraftSchema,
  receiptFormSchema,
  paymentVoucherRowSchema,
  paymentVoucherDraftSchema,
  paymentVoucherFormSchema,
  glEntryRowSchema,
  invoiceForAgingSchema,
  type Receipt,
  type ReceiptDraft,
  type ReceiptForm,
  type ReceiptMethod,
  type PaymentVoucher,
  type PaymentVoucherDraft,
  type PaymentVoucherForm,
  type VoucherDirection,
  type GlEntryRow,
  type InvoiceForAging,
} from './domain/schemas'
export {
  AGING_BUCKETS,
  RECEIVABLE_INVOICE_METHODS,
  bucketFor,
  customerAging,
  overdueTotal,
  type AgingBucket,
  type AgingInvoice,
  type AgingReceipt,
  type CustomerAging,
} from './domain/aging'
export {
  creditCheck,
  requiresOverride,
  type CreditCheckInput,
  type CreditCheckResult,
} from './domain/credit'
export {
  GlAccount,
  receiptToGlLines,
  voucherToGlLines,
  trialBalance,
  type GlAccountId,
  type TrialBalance,
  type TrialBalanceAccount,
} from './domain/gl'
export {
  RECEIPT_METHOD_LABELS,
  VOUCHER_DIRECTION_LABELS,
  AGING_BUCKET_LABELS,
  RECEIPT_METHOD_OPTIONS,
  VOUCHER_DIRECTION_OPTIONS,
} from './domain/labels'
