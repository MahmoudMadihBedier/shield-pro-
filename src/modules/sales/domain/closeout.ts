/**
 * Rep daily close-out reconciliation (`IMPLEMENTATION_PLAN.md` Phase 2 Story
 * 2.4 — the highest fraud-prevention-value control).
 *
 * Two checks:
 *  1. **Custody identity** — for every product the rep carried:
 *     `issued === sold + returned + remaining`.
 *  2. **Physical / cash reconciliation** — the physically counted stock must
 *     match `remaining`, and the counted cash must match the expected cash by
 *     method. Any non-zero delta beyond a small epsilon raises a flag, which
 *     moves the close-out to status `flagged` for Admin attention.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import type { CloseoutActual, CloseoutExpected } from './schemas'

/** Deltas within this are treated as exact (float noise / rounding). */
export const CLOSEOUT_EPSILON = 1e-6

export interface CloseoutReconciliation {
  /** Σ (counted − remaining) across products (signed). */
  stock_variance: number
  /** Σ (counted cash − expected cash) across methods (signed). */
  cash_variance: number
  /** Human-readable reasons; a non-empty list ⇒ the close-out is `flagged`. */
  flags: string[]
}

/** `true` when `issued === sold + returned + remaining` within epsilon. */
export function custodyIdentity(
  issued: number,
  sold: number,
  returned: number,
  remaining: number,
): boolean {
  return Math.abs(issued - (sold + returned + remaining)) <= CLOSEOUT_EPSILON
}

function nonZero(value: number): boolean {
  return Math.abs(value) > CLOSEOUT_EPSILON
}

/**
 * Reconcile the `expected` bag (built from the day's issues / sales / returns)
 * against the `actual` bag (physical count + counted cash).
 */
export function reconcileCloseout(
  expected: CloseoutExpected,
  actual: CloseoutActual,
): CloseoutReconciliation {
  const flags: string[] = []

  const countedByProduct = new Map(actual.products.map((p) => [p.product_id, p.counted]))
  let stock_variance = 0

  for (const p of expected.products) {
    // Custody identity: issued must equal sold + returned + remaining.
    if (!custodyIdentity(p.issued, p.sold, p.returned, p.remaining)) {
      const gap = p.issued - (p.sold + p.returned + p.remaining)
      flags.push(`custody:${p.product_id}:${gap}`)
    }
    // Physical count vs. expected remaining.
    const counted = countedByProduct.get(p.product_id) ?? 0
    const delta = counted - p.remaining
    stock_variance += delta
    if (nonZero(delta)) flags.push(`stock:${p.product_id}:${delta}`)
  }

  // A counted product with no expected row is unexplained stock on the rep.
  for (const a of actual.products) {
    if (!expected.products.some((p) => p.product_id === a.product_id) && nonZero(a.counted)) {
      stock_variance += a.counted
      flags.push(`stock:${a.product_id}:${a.counted}`)
    }
  }

  const countedCash = new Map(actual.cash.map((c) => [c.method, c.amount]))
  const expectedCash = new Map(expected.cash.map((c) => [c.method, c.amount]))
  const methods = new Set([...countedCash.keys(), ...expectedCash.keys()])
  let cash_variance = 0
  for (const method of methods) {
    const delta = (countedCash.get(method) ?? 0) - (expectedCash.get(method) ?? 0)
    cash_variance += delta
    if (nonZero(delta)) flags.push(`cash:${method}:${delta}`)
  }

  return {
    stock_variance: nonZero(stock_variance) ? stock_variance : 0,
    cash_variance: nonZero(cash_variance) ? cash_variance : 0,
    flags,
  }
}

/** The close-out status implied by a reconciliation result. */
export function closeoutOutcomeStatus(
  reconciliation: CloseoutReconciliation,
): 'confirmed' | 'flagged' {
  return reconciliation.flags.length > 0 ? 'flagged' : 'confirmed'
}
