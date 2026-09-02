/**
 * Central registry of Appwrite database + table (collection) ids.
 *
 * Nothing is provisioned yet — this is the target schema the setup script in
 * `docs/APPWRITE_SETUP.md` will create. Keeping the ids here means module data
 * layers reference a constant, never a string literal.
 */

export const DATABASE_ID = 'shield_pro'

export const Tables = {
  // ---- Master data (System Admin owned) ----
  users: 'users',
  branches: 'branches',
  warehouses: 'warehouses',
  products: 'products',
  productBom: 'product_bom',
  rawMaterials: 'raw_materials',
  customers: 'customers',
  suppliers: 'suppliers',

  // ---- Movement / transaction documents (submittable) ----
  purchaseOrders: 'purchase_orders',
  stockReceipts: 'stock_receipts',
  productionRequests: 'production_requests',
  productionBatches: 'production_batches',
  warehouseTransfers: 'warehouse_transfers',
  repStockIssues: 'rep_stock_issues',
  salesInvoices: 'sales_invoices',
  receipts: 'receipts',
  paymentVouchers: 'payment_vouchers',
  returnRequests: 'return_requests',
  writeOffs: 'write_offs',
  stockCountSessions: 'stock_count_sessions',
  repCloseouts: 'rep_closeouts',

  // ---- Immutable ledgers (append-only, server-written) ----
  stockLedger: 'stock_ledger_entries',
  generalLedger: 'general_ledger_entries',
  repStockLedger: 'rep_stock_ledger',
  repCashLedger: 'rep_cash_ledger',
  binBalances: 'bin_balances',

  // ---- Control plane ----
  approvalRequests: 'approval_requests',
  approvalRules: 'approval_rules',
  approvalRuleLog: 'approval_rule_log',
  fraudFlags: 'fraud_flags',
  notifications: 'notifications',
  auditLog: 'audit_log',
  namingSeries: 'naming_series_counters',
} as const

export type TableId = (typeof Tables)[keyof typeof Tables]
