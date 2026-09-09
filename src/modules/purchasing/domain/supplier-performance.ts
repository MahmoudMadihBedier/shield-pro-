/**
 * Supplier performance — Phase 4.2. Pure shaping of the `supplier_performance`
 * RPC payload: the aggregation is done in Postgres over `purchase_orders`
 * (migration 0027, branch-scoped server-side); this module only sorts and
 * flattens for display / export.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import { roundCents } from '@/core/money'

export interface SupplierPerformanceRow {
  supplierId: string
  supplierName: string
  /** Submitted (doc_status = 1) purchase orders. */
  orderCount: number
  /** Σ total_value of the submitted POs — spend with this supplier. */
  submittedValue: number
  avgOrderValue: number
  /** Purchase orders that ended cancelled (doc_status = 2). */
  cancelledCount: number
  /** cancelledCount / (orderCount + cancelledCount), 0..1. */
  cancelRate: number
  /** ISO datetime of the earliest submitted PO, or null if none. */
  firstOrderAt: string | null
  /** ISO datetime of the latest submitted PO, or null if none. */
  lastOrderAt: string | null
}

export interface SupplierPerformanceReport {
  rows: SupplierPerformanceRow[]
  totalSpend: number
  supplierCount: number
}

/**
 * Days since the supplier's last submitted order, relative to `now`. `null`
 * when the supplier has no submitted order or the date is unparseable.
 */
export function daysSinceLastOrder(
  row: Pick<SupplierPerformanceRow, 'lastOrderAt'>,
  now: number = Date.now(),
): number | null {
  if (!row.lastOrderAt) return null
  const ms = Date.parse(row.lastOrderAt)
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.floor((now - ms) / 86_400_000))
}

/**
 * Rows sorted by spend (desc), then name — the RPC already returns them this
 * way, but re-sorting keeps the domain the tested spec and lets callers pass
 * an unsorted list.
 */
export function sortBySpend(rows: readonly SupplierPerformanceRow[]): SupplierPerformanceRow[] {
  return [...rows].sort(
    (a, b) => b.submittedValue - a.submittedValue || a.supplierName.localeCompare(b.supplierName),
  )
}

/** Flat rows for CSV / Excel export. */
export function supplierPerformanceToRows(report: SupplierPerformanceReport): Array<{
  supplier: string
  orders: number
  spend: number
  avg_order_value: number
  cancelled: number
  cancel_rate_pct: number
  last_order: string
}> {
  return sortBySpend(report.rows).map((r) => ({
    supplier: r.supplierName,
    orders: r.orderCount,
    // `purchase_orders.total_value` is double precision and avg is a float
    // division in the RPC — snap both to whole cents for the export, same as
    // the inventory-valuation and customer-statement exports.
    spend: roundCents(r.submittedValue),
    avg_order_value: roundCents(r.avgOrderValue),
    cancelled: r.cancelledCount,
    cancel_rate_pct: Math.round(r.cancelRate * 1000) / 10,
    last_order: r.lastOrderAt ?? '',
  }))
}
