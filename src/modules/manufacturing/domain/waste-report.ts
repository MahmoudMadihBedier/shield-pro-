/**
 * Production Waste Report (Plan §4.1 "production/waste" export, §4.2
 * "production output, waste %"). Pure shaping over already-fetched Submitted
 * batches + the product catalogue — no fetching, no framework imports.
 */
import { wasteRatio, wasteWithinAllowance } from './costing'
import type { ProductionBatch } from './schemas'

export interface WasteReportRow {
  $id: string
  referenceId: string
  lotNumber: string
  productId: string
  productName: string
  producedQty: number
  wasteQty: number
  /** 0..1 fraction of total output that was waste. */
  ratio: number
  /** The product's allowed waste threshold, 0..100. */
  allowedPct: number
  withinAllowance: boolean
  postingDatetime: string
}

/** Looks up a product's name and `allowed_waste_pct`; falls back gracefully if the product is missing. */
export interface ProductWasteLookup {
  name(productId: string): string
  allowedPct(productId: string): number
}

export function buildProductWasteLookup(
  products: readonly { $id: string; name: string; allowed_waste_pct: number }[],
): ProductWasteLookup {
  const byId = new Map(products.map((p) => [p.$id, p]))
  return {
    name: (productId) => byId.get(productId)?.name ?? productId,
    allowedPct: (productId) => byId.get(productId)?.allowed_waste_pct ?? 0,
  }
}

/**
 * Shapes Submitted production batches into report rows, newest first. A batch
 * with no output at all (`produced_qty + waste_qty <= 0`) is excluded — there
 * is no meaningful ratio to report.
 */
export function buildWasteReportRows(
  batches: readonly ProductionBatch[],
  lookup: ProductWasteLookup,
): WasteReportRow[] {
  return batches
    .filter((b) => b.produced_qty + b.waste_qty > 0)
    .map((b) => {
      const ratio = wasteRatio(b.produced_qty, b.waste_qty)
      const allowedPct = lookup.allowedPct(b.product_id)
      return {
        $id: b.$id,
        referenceId: b.reference_id,
        lotNumber: b.lot_number,
        productId: b.product_id,
        productName: lookup.name(b.product_id),
        producedQty: b.produced_qty,
        wasteQty: b.waste_qty,
        ratio,
        allowedPct,
        withinAllowance: wasteWithinAllowance(ratio, allowedPct),
        postingDatetime: b.posting_datetime,
      }
    })
    .sort((a, b) => b.postingDatetime.localeCompare(a.postingDatetime))
}

export interface WasteReportSummary {
  batchCount: number
  totalProduced: number
  totalWaste: number
  /** Overall waste ratio across every row (0..1), not an average of per-row ratios. */
  overallRatio: number
  exceedingCount: number
}

export function summarizeWasteReport(rows: readonly WasteReportRow[]): WasteReportSummary {
  const totalProduced = rows.reduce((sum, r) => sum + r.producedQty, 0)
  const totalWaste = rows.reduce((sum, r) => sum + r.wasteQty, 0)
  return {
    batchCount: rows.length,
    totalProduced,
    totalWaste,
    overallRatio: wasteRatio(totalProduced, totalWaste),
    exceedingCount: rows.filter((r) => !r.withinAllowance).length,
  }
}

/** Row shape for `<ExportButton>` — flat, string/number values only. */
export function wasteReportToCsvRows(rows: readonly WasteReportRow[]) {
  return rows.map((r) => ({
    reference_id: r.referenceId,
    lot_number: r.lotNumber,
    product: r.productName,
    produced_qty: r.producedQty,
    waste_qty: r.wasteQty,
    waste_pct: Math.round(r.ratio * 1000) / 10,
    allowed_waste_pct: r.allowedPct,
    within_allowance: r.withinAllowance ? 'نعم' : 'لا',
    posting_datetime: r.postingDatetime,
  }))
}
