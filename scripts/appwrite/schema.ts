/**
 * Declarative Appwrite schema for Shield Pro — the single source of truth for
 * the database, tables, columns, indexes and permissions.
 *
 * `provision.ts` reads this and applies it idempotently. Never hand-edit schema
 * in the Appwrite console (claude.md Section C).
 *
 * Design notes:
 *  - Table ids come from `src/infrastructure/appwrite/collections.ts` so the app
 *    and the provisioner can never drift.
 *  - Movement / financial documents carry the ERPNext-style envelope:
 *    `reference_id`, `doc_status` (0 Draft / 1 Submitted / 2 Cancelled),
 *    `branch_id`, `created_by`, `amended_from`, `posting_datetime`.
 *  - Line items are stored as a JSON string column (`lines`) for v1 rather than
 *    child-table relationships — revisit if querying inside lines is needed.
 *  - Ledgers have NO client write permission. Their only writer is an Appwrite
 *    Function using an API key. Documents allow client `create` (Draft only);
 *    submit/cancel go through Functions.
 */
import { Permission, Role } from 'node-appwrite'

import { DATABASE_ID, Tables } from '../../src/infrastructure/appwrite/collections'
import { Role as StaffRole } from '../../src/core/rbac'

export const DATABASE = { id: DATABASE_ID, name: 'Shield Pro' }

/** Teams that back RBAC — one per staff role (see src/core/rbac.ts). */
export const TEAMS: ReadonlyArray<{ id: string; name: string }> = Object.entries(StaffRole).map(
  ([label, id]) => ({ id, name: label.replace(/([a-z])([A-Z])/g, '$1 $2') }),
)

const admin = Role.team(StaffRole.SystemAdmin)

/** Read for any signed-in user; all writes restricted to the System Admin team. */
const masterDataPerms = [
  Permission.read(Role.users()),
  Permission.create(admin),
  Permission.update(admin),
  Permission.delete(admin),
]

/** Read for any signed-in user; client may create Drafts. Submit/cancel + all
 *  updates happen in Functions (API key). Row-level perms narrow per branch. */
const documentPerms = [Permission.read(Role.users()), Permission.create(Role.users())]

/** Append-only ledgers + control tables: readable, never client-writable. */
const readOnlyPerms = [Permission.read(Role.users())]

// ---------------------------------------------------------------------------
// Column + index vocabulary
// ---------------------------------------------------------------------------

export type Column =
  | {
      key: string
      type: 'string'
      size: number
      required?: boolean
      default?: string
      array?: boolean
    }
  | { key: string; type: 'enum'; elements: string[]; required?: boolean; default?: string }
  | {
      key: string
      type: 'integer'
      required?: boolean
      min?: number
      max?: number
      default?: number
    }
  | { key: string; type: 'float'; required?: boolean; min?: number; max?: number; default?: number }
  | { key: string; type: 'boolean'; required?: boolean; default?: boolean }
  | { key: string; type: 'datetime'; required?: boolean }

export interface Index {
  key: string
  type: 'key' | 'unique'
  columns: string[]
}

export interface TableDef {
  id: string
  name: string
  permissions: string[]
  rowSecurity: boolean
  columns: Column[]
  indexes: Index[]
}

// Reusable column groups -----------------------------------------------------

const str = (key: string, size: number, required = false): Column => ({
  key,
  type: 'string',
  size,
  required,
})

/** ERPNext-style document envelope shared by every submittable document. */
const documentEnvelope: Column[] = [
  str('reference_id', 32, true),
  { key: 'doc_status', type: 'integer', required: true, min: 0, max: 2, default: 0 },
  str('branch_id', 36),
  str('created_by', 36, true),
  str('amended_from', 32),
  { key: 'posting_datetime', type: 'datetime', required: true },
  str('remarks', 2000),
]

const envelopeIndexes = (id: string): Index[] => [
  { key: `${id}_reference_id_uq`, type: 'unique', columns: ['reference_id'] },
  { key: `${id}_branch_idx`, type: 'key', columns: ['branch_id'] },
  { key: `${id}_status_idx`, type: 'key', columns: ['doc_status'] },
  { key: `${id}_posting_idx`, type: 'key', columns: ['posting_datetime'] },
]

const doc = (id: string, name: string, extra: Column[], extraIndexes: Index[] = []): TableDef => ({
  id,
  name,
  permissions: documentPerms,
  rowSecurity: true,
  columns: [...documentEnvelope, ...extra],
  indexes: [...envelopeIndexes(id), ...extraIndexes],
})

const master = (id: string, name: string, columns: Column[], indexes: Index[] = []): TableDef => ({
  id,
  name,
  permissions: masterDataPerms,
  rowSecurity: false,
  columns,
  indexes,
})

const ledger = (id: string, name: string, columns: Column[], indexes: Index[] = []): TableDef => ({
  id,
  name,
  permissions: readOnlyPerms,
  rowSecurity: true,
  columns,
  indexes,
})

const control = (id: string, name: string, columns: Column[], indexes: Index[] = []): TableDef => ({
  id,
  name,
  permissions: readOnlyPerms,
  rowSecurity: true,
  columns,
  indexes,
})

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const TABLES: TableDef[] = [
  // ---- Master data ----
  master(
    Tables.branches,
    'Branches',
    [
      str('name', 128, true),
      str('name_ar', 128),
      str('location', 256),
      str('sub_warehouse_id', 36),
      str('branch_accountant_id', 36),
      { key: 'is_active', type: 'boolean', default: true },
    ],
    [{ key: 'branches_name_uq', type: 'unique', columns: ['name'] }],
  ),

  master(
    Tables.warehouses,
    'Warehouses',
    [
      str('name', 128, true),
      {
        key: 'kind',
        type: 'enum',
        elements: ['raw_store', 'factory_custody', 'main', 'sub', 'rep_custody'],
        required: true,
      },
      str('branch_id', 36),
      str('owner_user_id', 36),
      { key: 'is_active', type: 'boolean', default: true },
    ],
    [{ key: 'warehouses_kind_idx', type: 'key', columns: ['kind'] }],
  ),

  master(
    Tables.users,
    'Users (profile)',
    [
      str('auth_user_id', 36, true),
      str('full_name', 128, true),
      str('roles', 64, false),
      str('branch_id', 36),
      str('sub_warehouse_id', 36),
      str('job_grade', 64),
      { key: 'is_active', type: 'boolean', default: true },
    ],
    [
      { key: 'users_auth_uq', type: 'unique', columns: ['auth_user_id'] },
      { key: 'users_branch_idx', type: 'key', columns: ['branch_id'] },
    ],
  ),

  master(
    Tables.products,
    'Products',
    [
      str('code', 32, true),
      str('name', 128, true),
      str('name_ar', 128),
      str('uom', 16, true),
      { key: 'base_price', type: 'float', required: true, min: 0 },
      { key: 'default_discount_pct', type: 'float', default: 0, min: 0, max: 100 },
      { key: 'allowed_waste_pct', type: 'float', default: 0, min: 0, max: 100 },
      { key: 'is_active', type: 'boolean', default: true },
    ],
    [{ key: 'products_code_uq', type: 'unique', columns: ['code'] }],
  ),

  master(
    Tables.productBom,
    'Product BOM lines',
    [
      str('product_id', 36, true),
      str('raw_material_id', 36, true),
      { key: 'qty_per_unit', type: 'float', required: true, min: 0 },
    ],
    [{ key: 'bom_product_idx', type: 'key', columns: ['product_id'] }],
  ),

  master(
    Tables.rawMaterials,
    'Raw materials',
    [
      str('code', 32, true),
      str('name', 128, true),
      str('uom', 16, true),
      { key: 'purchase_price', type: 'float', default: 0, min: 0 },
      str('preferred_supplier_id', 36),
      { key: 'reorder_point', type: 'float', default: 0, min: 0 },
    ],
    [{ key: 'raw_materials_code_uq', type: 'unique', columns: ['code'] }],
  ),

  master(Tables.suppliers, 'Suppliers', [
    str('name', 128, true),
    str('contact', 128),
    str('phone', 32),
  ]),

  master(
    Tables.customers,
    'Customers',
    [
      str('code', 32, true),
      str('name', 128, true),
      str('phone', 32),
      str('branch_id', 36, true),
      str('geo', 64), // "lat,lng" — mandatory on create, enforced in domain
      { key: 'discount_pct', type: 'float', default: 0, min: 0, max: 100 },
      { key: 'credit_limit', type: 'float', default: 0, min: 0 },
      { key: 'payment_terms_days', type: 'integer', default: 0, min: 0 },
      {
        key: 'approval_state',
        type: 'enum',
        elements: ['approved', 'pending_approval'],
        required: true,
        default: 'pending_approval',
      },
      str('created_by', 36),
    ],
    [
      { key: 'customers_code_uq', type: 'unique', columns: ['code'] },
      { key: 'customers_branch_idx', type: 'key', columns: ['branch_id'] },
      { key: 'customers_approval_idx', type: 'key', columns: ['approval_state'] },
    ],
  ),

  // ---- Movement / transaction documents ----
  doc(Tables.purchaseOrders, 'Purchase orders', [
    str('supplier_id', 36, true),
    str('lines', 100000), // JSON: [{raw_material_id, qty, unit_price}]
    { key: 'total_value', type: 'float', default: 0, min: 0 },
  ]),

  doc(
    Tables.stockReceipts,
    'Raw-material receipts',
    [str('purchase_order_ref', 32, true), str('supplier_lot_number', 64), str('lines', 100000)],
    [{ key: 'stock_receipts_po_idx', type: 'key', columns: ['purchase_order_ref'] }],
  ),

  doc(Tables.productionRequests, 'Production requests', [
    str('product_id', 36, true),
    { key: 'planned_qty', type: 'float', required: true, min: 0 },
    str('required_materials', 100000), // JSON computed from BOM
    {
      key: 'status',
      type: 'enum',
      elements: ['pending', 'approved', 'rejected', 'issued'],
      required: true,
      default: 'pending',
    },
  ]),

  doc(
    Tables.productionBatches,
    'Production batches',
    [
      str('production_request_ref', 32),
      str('product_id', 36, true),
      str('lot_number', 64, true),
      { key: 'produced_qty', type: 'float', required: true, min: 0 },
      { key: 'waste_qty', type: 'float', default: 0, min: 0 },
      str('raw_material_lots', 100000), // JSON: [{purchase_order_ref, qty_consumed}]
      { key: 'expected_cost', type: 'float', default: 0 },
      { key: 'expected_profit', type: 'float', default: 0 },
      {
        key: 'qc_status',
        type: 'enum',
        elements: ['pending_qc', 'released', 'rejected'],
        required: true,
        default: 'pending_qc',
      },
      str('qc_by', 36),
      str('expiry_date', 32),
    ],
    [
      { key: 'batches_lot_uq', type: 'unique', columns: ['lot_number'] },
      { key: 'batches_qc_idx', type: 'key', columns: ['qc_status'] },
    ],
  ),

  doc(
    Tables.warehouseTransfers,
    'Warehouse transfers',
    [
      str('from_warehouse_id', 36, true),
      str('to_warehouse_id', 36, true),
      str('lines', 100000), // JSON: [{product_id, qty, lot_number}]
      {
        key: 'status',
        type: 'enum',
        elements: ['pending', 'approved', 'rejected', 'executed', 'received'],
        required: true,
        default: 'pending',
      },
      str('requested_by', 36),
      str('approved_by', 36),
      str('sent_by', 36),
      str('confirmed_received_by', 36),
    ],
    [{ key: 'transfers_status_idx', type: 'key', columns: ['status'] }],
  ),

  doc(
    Tables.repStockIssues,
    'Rep stock issues',
    [
      str('sub_warehouse_id', 36, true),
      str('rep_user_id', 36, true),
      str('lines', 100000),
      {
        key: 'status',
        type: 'enum',
        elements: ['pending', 'approved', 'rejected', 'issued'],
        required: true,
        default: 'pending',
      },
      str('requested_by', 36),
      str('approved_by', 36),
    ],
    [{ key: 'rep_issues_rep_idx', type: 'key', columns: ['rep_user_id'] }],
  ),

  doc(
    Tables.salesInvoices,
    'Sales invoices',
    [
      str('customer_id', 36, true),
      str('rep_user_id', 36, true),
      str('lines', 100000), // JSON: [{product_id, qty, base_price, discount_pct, net_price}]
      { key: 'gross_total', type: 'float', required: true, min: 0 },
      { key: 'discount_total', type: 'float', default: 0, min: 0 },
      { key: 'net_total', type: 'float', required: true, min: 0 },
      {
        key: 'payment_method',
        type: 'enum',
        elements: ['cash', 'credit', 'bank_transfer', 'partial', 'post_dated_cheque'],
        required: true,
      },
      { key: 'cash_amount', type: 'float', default: 0, min: 0 },
      { key: 'credit_amount', type: 'float', default: 0, min: 0 },
      str('bank_reference', 64),
      str('geo', 64, true), // locked rep geolocation at issue time
      str('sold_by', 36),
      str('cashup_confirmed_by', 36),
    ],
    [
      { key: 'invoices_customer_idx', type: 'key', columns: ['customer_id'] },
      { key: 'invoices_rep_idx', type: 'key', columns: ['rep_user_id'] },
      { key: 'invoices_payment_idx', type: 'key', columns: ['payment_method'] },
    ],
  ),

  doc(
    Tables.receipts,
    'Collections / receipts',
    [
      str('invoice_ref', 32, true),
      str('customer_id', 36, true),
      { key: 'amount', type: 'float', required: true, min: 0 },
      {
        key: 'method',
        type: 'enum',
        elements: ['cash', 'bank_transfer', 'post_dated_cheque'],
        required: true,
      },
      str('evidence_file_id', 64),
      str('collected_by', 36),
    ],
    [{ key: 'receipts_invoice_idx', type: 'key', columns: ['invoice_ref'] }],
  ),

  doc(Tables.paymentVouchers, 'Payment vouchers', [
    { key: 'direction', type: 'enum', elements: ['receipt', 'payment'], required: true },
    { key: 'amount', type: 'float', required: true, min: 0 },
    str('reason', 512, true),
    str('counterparty', 128),
    str('treasury_account', 64),
    str('evidence_file_id', 64),
  ]),

  doc(
    Tables.returnRequests,
    'Return requests',
    [
      str('origin_ref', 32, true), // the INV- / TRF- being reversed
      str('lines', 100000),
      str('reason', 512, true),
      {
        key: 'status',
        type: 'enum',
        elements: ['pending', 'approved', 'rejected'],
        required: true,
        default: 'pending',
      },
      str('requested_by', 36),
      str('approved_by', 36),
    ],
    [{ key: 'returns_origin_idx', type: 'key', columns: ['origin_ref'] }],
  ),

  doc(Tables.writeOffs, 'Write-offs / damages', [
    str('warehouse_id', 36, true),
    str('lines', 100000),
    { key: 'kind', type: 'enum', elements: ['damage', 'loss', 'scrap'], required: true },
    str('reason', 512, true),
    str('requested_by', 36),
    str('approved_by', 36),
  ]),

  doc(Tables.stockCountSessions, 'Stock count sessions', [
    str('warehouse_id', 36, true),
    str('counts', 100000), // JSON: [{product_id, counted_qty}]
    str('variances', 100000), // JSON computed vs recorded
    {
      key: 'status',
      type: 'enum',
      elements: ['open', 'submitted', 'signed_off'],
      required: true,
      default: 'open',
    },
    str('signed_off_by', 36),
  ]),

  doc(
    Tables.repCloseouts,
    'Rep daily close-outs',
    [
      str('rep_user_id', 36, true),
      str('business_date', 32, true),
      str('expected', 100000), // JSON: issued/sold/returned/remaining + expected cash
      str('actual', 100000), // JSON: physical count + counted cash
      { key: 'stock_variance', type: 'float', default: 0 },
      { key: 'cash_variance', type: 'float', default: 0 },
      {
        key: 'status',
        type: 'enum',
        elements: ['open', 'submitted', 'confirmed', 'flagged'],
        required: true,
        default: 'open',
      },
      str('confirmed_by', 36),
    ],
    [{ key: 'closeouts_rep_date_uq', type: 'unique', columns: ['rep_user_id', 'business_date'] }],
  ),

  // ---- Immutable ledgers (Function-written only) ----
  ledger(
    Tables.stockLedger,
    'Stock ledger entries',
    [
      str('voucher_type', 32, true),
      str('voucher_no', 32, true),
      str('product_id', 36, true),
      str('warehouse_id', 36, true),
      str('lot_number', 64),
      { key: 'qty_change', type: 'float', required: true },
      { key: 'qty_after', type: 'float', required: true },
      { key: 'valuation_rate', type: 'float', default: 0 },
      { key: 'posting_datetime', type: 'datetime', required: true },
      { key: 'is_cancelled', type: 'boolean', default: false },
    ],
    [
      { key: 'sle_voucher_idx', type: 'key', columns: ['voucher_no'] },
      { key: 'sle_item_wh_idx', type: 'key', columns: ['product_id', 'warehouse_id'] },
      { key: 'sle_posting_idx', type: 'key', columns: ['posting_datetime'] },
    ],
  ),

  ledger(
    Tables.generalLedger,
    'General ledger entries',
    [
      str('voucher_type', 32, true),
      str('voucher_no', 32, true),
      str('account', 64, true),
      str('branch_id', 36),
      { key: 'debit', type: 'float', default: 0, min: 0 },
      { key: 'credit', type: 'float', default: 0, min: 0 },
      { key: 'posting_datetime', type: 'datetime', required: true },
      { key: 'is_cancelled', type: 'boolean', default: false },
    ],
    [
      { key: 'gle_voucher_idx', type: 'key', columns: ['voucher_no'] },
      { key: 'gle_account_idx', type: 'key', columns: ['account'] },
    ],
  ),

  ledger(
    Tables.repStockLedger,
    'Rep stock ledger',
    [
      str('rep_user_id', 36, true),
      str('product_id', 36, true),
      str('voucher_no', 32, true),
      { key: 'qty_change', type: 'float', required: true },
      { key: 'qty_after', type: 'float', required: true },
      { key: 'posting_datetime', type: 'datetime', required: true },
    ],
    [{ key: 'rsl_rep_item_idx', type: 'key', columns: ['rep_user_id', 'product_id'] }],
  ),

  ledger(
    Tables.repCashLedger,
    'Rep cash ledger',
    [
      str('rep_user_id', 36, true),
      str('voucher_no', 32, true),
      { key: 'method', type: 'enum', elements: ['cash', 'bank_transfer', 'post_dated_cheque'] },
      { key: 'amount_change', type: 'float', required: true },
      { key: 'amount_after', type: 'float', required: true },
      { key: 'posting_datetime', type: 'datetime', required: true },
    ],
    [{ key: 'rcl_rep_idx', type: 'key', columns: ['rep_user_id'] }],
  ),

  ledger(
    Tables.binBalances,
    'Bin balances (projection)',
    [
      str('product_id', 36, true),
      str('warehouse_id', 36, true),
      { key: 'qty', type: 'float', required: true, default: 0 },
      { key: 'updated_datetime', type: 'datetime', required: true },
    ],
    [{ key: 'bin_item_wh_uq', type: 'unique', columns: ['product_id', 'warehouse_id'] }],
  ),

  // ---- Control plane ----
  control(
    Tables.approvalRequests,
    'Approval requests',
    [
      str('entity_type', 32, true),
      str('entity_ref', 32, true),
      str('branch_id', 36),
      str('requested_by', 36, true),
      {
        key: 'state',
        type: 'enum',
        elements: ['pending', 'auto_approved', 'approved', 'rejected'],
        required: true,
        default: 'pending',
      },
      str('decided_by', 36),
      str('decision_reason', 512),
      { key: 'created_at', type: 'datetime', required: true },
    ],
    [
      { key: 'approvals_state_idx', type: 'key', columns: ['state'] },
      { key: 'approvals_entity_idx', type: 'key', columns: ['entity_ref'] },
    ],
  ),

  master(Tables.approvalRules, 'Approval rules', [
    str('movement_type', 32, true),
    str('predicate', 4000, true), // JSON rule definition
    { key: 'action', type: 'enum', elements: ['auto_approve', 'force_manual'], required: true },
    { key: 'priority', type: 'integer', default: 100 },
    { key: 'is_active', type: 'boolean', default: true },
  ]),

  control(
    Tables.approvalRuleLog,
    'Approval rule evaluations',
    [
      str('movement_type', 32, true),
      str('entity_ref', 32, true),
      str('actor_id', 36),
      str('rule_matched', 64),
      str('outcome', 32, true),
      { key: 'created_at', type: 'datetime', required: true },
    ],
    [{ key: 'rule_log_entity_idx', type: 'key', columns: ['entity_ref'] }],
  ),

  control(
    Tables.fraudFlags,
    'Fraud flags',
    [
      {
        key: 'kind',
        type: 'enum',
        elements: ['round_tripping', 'repeated_movement', 'high_reversal_ratio'],
        required: true,
      },
      str('subject_type', 32, true),
      str('subject_id', 36, true),
      str('detail', 2000),
      {
        key: 'status',
        type: 'enum',
        elements: ['open', 'reviewed', 'dismissed'],
        required: true,
        default: 'open',
      },
      { key: 'created_at', type: 'datetime', required: true },
    ],
    [{ key: 'fraud_status_idx', type: 'key', columns: ['status'] }],
  ),

  control(
    Tables.notifications,
    'Notifications',
    [
      str('recipient_user_id', 36, true),
      str('kind', 48, true),
      str('title', 200, true),
      str('body', 2000),
      str('entity_ref', 32),
      { key: 'is_read', type: 'boolean', default: false },
      { key: 'created_at', type: 'datetime', required: true },
    ],
    [
      { key: 'notif_recipient_idx', type: 'key', columns: ['recipient_user_id'] },
      { key: 'notif_read_idx', type: 'key', columns: ['is_read'] },
    ],
  ),

  control(
    Tables.auditLog,
    'Audit log',
    [
      str('actor_id', 36, true),
      str('action', 48, true),
      str('entity_type', 32, true),
      str('entity_ref', 32, true),
      str('before', 100000),
      str('after', 100000),
      { key: 'created_at', type: 'datetime', required: true },
    ],
    [
      { key: 'audit_entity_idx', type: 'key', columns: ['entity_ref'] },
      { key: 'audit_actor_idx', type: 'key', columns: ['actor_id'] },
      { key: 'audit_created_idx', type: 'key', columns: ['created_at'] },
    ],
  ),

  master(
    Tables.namingSeries,
    'Naming series counters',
    [
      str('prefix', 16, true),
      { key: 'year', type: 'integer', required: true, min: 2000, max: 9999 },
      { key: 'next_value', type: 'integer', required: true, min: 1, default: 1 },
    ],
    [{ key: 'naming_prefix_year_uq', type: 'unique', columns: ['prefix', 'year'] }],
  ),
]
