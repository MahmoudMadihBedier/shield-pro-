/**
 * Physical-count variance maths (`IMPLEMENTATION_PLAN.md` Phase 2 Story 2.9).
 *
 * A stock-count session records a physically counted qty per product; the
 * variance is `counted - recorded`, where "recorded" is the current
 * `bin_balances` projection for that product in the counted warehouse.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import { parseLines, serializeLines } from './line-utils'
import { countLineSchema, varianceLineSchema, type CountLine, type VarianceLine } from './schemas'

/**
 * Build a variance line per counted product. `recordedByProduct` is the
 * `bin_balances` qty keyed by `product_id`; a product with no bin row counts
 * as a recorded qty of 0.
 */
export function computeVariances(
  countLines: readonly CountLine[],
  recordedByProduct: ReadonlyMap<string, number>,
): VarianceLine[] {
  return countLines.map((line) => {
    const recorded = recordedByProduct.get(line.product_id) ?? 0
    return {
      product_id: line.product_id,
      recorded_qty: recorded,
      counted_qty: line.counted_qty,
      variance: line.counted_qty - recorded,
    }
  })
}

/** `true` when at least one line's physical count differs from the record. */
export function hasVariance(variances: readonly VarianceLine[]): boolean {
  return variances.some((line) => line.variance !== 0)
}

// --- JSON round-trips for the `counts` / `variances` columns ----------------

export function serializeCounts(lines: readonly CountLine[]): string {
  return serializeLines(lines)
}

export function parseCounts(raw: string | null | undefined): CountLine[] {
  return parseLines(raw, countLineSchema)
}

export function serializeVariances(lines: readonly VarianceLine[]): string {
  return serializeLines(lines)
}

export function parseVariances(raw: string | null | undefined): VarianceLine[] {
  return parseLines(raw, varianceLineSchema)
}
