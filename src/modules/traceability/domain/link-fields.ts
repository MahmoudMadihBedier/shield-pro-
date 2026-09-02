/**
 * Declarative map of the cross-document links in the frozen Appwrite schema
 * (`scripts/appwrite/schema.ts`). This is the ONLY place that encodes "which
 * column points at which document" — the data layer reads it to assemble a
 * `ChainNode`'s parents and children.
 *
 * Forward links (a row naming its producers):
 *   - `amended_from`          — on every submittable document
 *   - `purchase_order_ref`    — stock_receipts     → purchase_orders
 *   - `production_request_ref`— production_batches  → production_requests
 *   - `origin_ref`            — return_requests     → sales_invoices / warehouse_transfers
 *   - `invoice_ref`           — receipts            → sales_invoices
 *
 * Reverse links are just the same columns queried the other way.
 *
 * Keyed by the reference-id prefix from `src/core/reference-id.ts`
 * (`REFERENCE_PREFIXES`). Ledger prefixes (`SLE`, `GLE`) and `ADJ` are omitted:
 * they are not submittable documents and are not part of the walkable chain.
 *
 * `domain` has ZERO framework imports — plain TypeScript only.
 */
import { SUBMITTABLE_DOC_TABLES, type SubmittableDocTable } from '@/core/document'
import { REFERENCE_PREFIXES } from '@/core/reference-id'

/** Column present on every submittable document, always a parent link. */
export const UNIVERSAL_PARENT_COLUMNS = ['amended_from'] as const

export interface PrefixLink {
  table: SubmittableDocTable
  /** Columns (besides `amended_from`) whose value is a parent reference id. */
  parentRefColumns: string[]
}

/** reference-id prefix → the table it lives in + its parent-link columns. */
export const PREFIX_LINKS: Record<string, PrefixLink> = {
  [REFERENCE_PREFIXES.PurchaseOrder]: { table: 'purchase_orders', parentRefColumns: [] },
  [REFERENCE_PREFIXES.StockReceipt]: {
    table: 'stock_receipts',
    parentRefColumns: ['purchase_order_ref'],
  },
  [REFERENCE_PREFIXES.ProductionRequest]: { table: 'production_requests', parentRefColumns: [] },
  [REFERENCE_PREFIXES.ProductionBatch]: {
    table: 'production_batches',
    parentRefColumns: ['production_request_ref'],
  },
  [REFERENCE_PREFIXES.WarehouseTransfer]: { table: 'warehouse_transfers', parentRefColumns: [] },
  [REFERENCE_PREFIXES.RepStockIssue]: { table: 'rep_stock_issues', parentRefColumns: [] },
  [REFERENCE_PREFIXES.SalesInvoice]: { table: 'sales_invoices', parentRefColumns: [] },
  [REFERENCE_PREFIXES.Receipt]: { table: 'receipts', parentRefColumns: ['invoice_ref'] },
  [REFERENCE_PREFIXES.PaymentVoucher]: { table: 'payment_vouchers', parentRefColumns: [] },
  [REFERENCE_PREFIXES.ReturnRequest]: {
    table: 'return_requests',
    parentRefColumns: ['origin_ref'],
  },
  [REFERENCE_PREFIXES.WriteOff]: { table: 'write_offs', parentRefColumns: [] },
  [REFERENCE_PREFIXES.StockCountSession]: { table: 'stock_count_sessions', parentRefColumns: [] },
  [REFERENCE_PREFIXES.RepCloseout]: { table: 'rep_closeouts', parentRefColumns: [] },
}

export interface ReverseLookup {
  table: SubmittableDocTable
  column: string
}

/**
 * Every column that can hold a reference id pointing back at another document.
 * The data layer runs these to find a node's children — one query per table
 * (columns on the same table are OR-ed together), so the read count per node is
 * bounded by the number of distinct tables here.
 */
export const REVERSE_LOOKUPS: ReverseLookup[] = [
  { table: 'stock_receipts', column: 'purchase_order_ref' },
  { table: 'production_batches', column: 'production_request_ref' },
  { table: 'return_requests', column: 'origin_ref' },
  { table: 'receipts', column: 'invoice_ref' },
  ...SUBMITTABLE_DOC_TABLES.map((table) => ({ table, column: 'amended_from' as const })),
]

/** Group `REVERSE_LOOKUPS` by table so the data layer issues one query per table. */
export function reverseLookupsByTable(): Array<{ table: SubmittableDocTable; columns: string[] }> {
  const byTable = new Map<SubmittableDocTable, string[]>()
  for (const { table, column } of REVERSE_LOOKUPS) {
    const cols = byTable.get(table) ?? []
    if (!cols.includes(column)) cols.push(column)
    byTable.set(table, cols)
  }
  return [...byTable.entries()].map(([table, columns]) => ({ table, columns }))
}
