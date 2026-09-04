/**
 * Expected cost / profit / waste math for a production batch. Pure functions —
 * the presentation layer feeds them live form values, and the enforcing
 * Appwrite Function re-computes the authoritative figures at submit time
 * (Phase 2). No react, no appwrite imports.
 */
import type { RawMaterialLot } from './schemas'

/** Absolute rounding error tolerated when comparing ratios. */
const TOLERANCE = 1e-9

/**
 * Σ (qty_consumed × unit price) over the consumed raw-material lots.
 *
 * `rawPriceById` is keyed by the same string used in
 * `raw_material_lots[].purchase_order_ref`; an unknown key contributes 0 (the
 * live estimate degrades gracefully — the Function does the real costing).
 */
export function expectedCost(
  rawLots: readonly RawMaterialLot[],
  rawPriceById: ReadonlyMap<string, number>,
): number {
  return rawLots.reduce(
    (sum, lot) => sum + lot.qty_consumed * (rawPriceById.get(lot.purchase_order_ref) ?? 0),
    0,
  )
}

/** Revenue at `sellPrice` for `producedQty` units, less `cost`. */
export function expectedProfit(producedQty: number, sellPrice: number, cost: number): number {
  return producedQty * sellPrice - cost
}

/**
 * Waste as a fraction of total output: `waste / (produced + waste)`.
 * Returns 0 when there is no output at all.
 */
export function wasteRatio(produced: number, waste: number): number {
  const total = produced + waste
  if (total <= 0) return 0
  return waste / total
}

/**
 * Is a waste `ratio` (0..1) within the product's `allowedPct` (0..100)?
 * The boundary (`ratio === allowedPct / 100`) counts as within allowance.
 */
export function wasteWithinAllowance(ratio: number, allowedPct: number): boolean {
  return ratio - allowedPct / 100 <= TOLERANCE
}
