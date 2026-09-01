/**
 * Ledger math — the pure, framework-free core shared by the `/post-stock-ledger`
 * and `/post-gl` Functions (Implementation Plan §4.3, Phase 1 Story 1.3).
 *
 * Two invariants this module exists to protect:
 *   1. Double-entry GL postings must balance — Σ debit === Σ credit, no negatives.
 *   2. A stock bin can never be driven negative by a posting.
 *
 * Failures throw a `LedgerError` carrying a machine-readable `code`. The data
 * layer (Functions) catches it and re-maps to an `FnError` on the wire; nothing
 * in `core` knows about HTTP, so — unlike `FnError` — there is no `status` here.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

/** Absolute rounding error tolerated when comparing money / quantity sums. */
export const LEDGER_TOLERANCE = 1e-6

export type LedgerErrorCode = 'unbalanced' | 'negative_amount' | 'negative_stock'

export class LedgerError extends Error {
  readonly code: LedgerErrorCode
  constructor(code: LedgerErrorCode, message: string) {
    super(message)
    this.name = 'LedgerError'
    this.code = code
  }
}

/** One side of a double-entry posting. Exactly one of `debit` / `credit` is
 *  non-zero in practice, but the type does not force it — `assertBalanced` is
 *  the gate. */
export interface GlLine {
  account: string
  debit: number
  credit: number
}

/** Build a debit line (`credit` = 0). */
export function DEBIT(account: string, amount: number): GlLine {
  return { account, debit: amount, credit: 0 }
}

/** Build a credit line (`debit` = 0). */
export function CREDIT(account: string, amount: number): GlLine {
  return { account, debit: 0, credit: amount }
}

/**
 * Throw unless `lines` form a valid double-entry posting:
 *   - no negative `debit` or `credit` on any line, and
 *   - Σ debit === Σ credit within `LEDGER_TOLERANCE`.
 *
 * An empty array is trivially balanced (0 === 0); callers that require at least
 * one line must check length themselves.
 */
export function assertBalanced(lines: GlLine[]): void {
  let debit = 0
  let credit = 0
  for (const line of lines) {
    if (line.debit < 0 || line.credit < 0) {
      throw new LedgerError(
        'negative_amount',
        `GL line for "${line.account}" has a negative amount (debit ${line.debit}, credit ${line.credit})`,
      )
    }
    debit += line.debit
    credit += line.credit
  }
  if (Math.abs(debit - credit) > LEDGER_TOLERANCE) {
    throw new LedgerError(
      'unbalanced',
      `GL posting is not balanced: Σ debit ${debit} ≠ Σ credit ${credit}`,
    )
  }
}

/**
 * Running bin quantity after applying `change` (signed: negative = issue).
 * Throws `negative_stock` if the result would fall below zero (beyond
 * `LEDGER_TOLERANCE`). A result within tolerance of zero is clamped to exactly 0
 * so floating-point drift never leaves a phantom sliver in a bin.
 */
export function nextQtyAfter(current: number, change: number): number {
  const next = current + change
  if (next < -LEDGER_TOLERANCE) {
    throw new LedgerError(
      'negative_stock',
      `stock for this bin cannot go negative: ${current} + (${change}) = ${next}`,
    )
  }
  return next < 0 ? 0 : next
}

/**
 * Moving weighted-average valuation rate after a receipt.
 *
 *   rate = (prevQty·prevRate + inQty·inRate) / (prevQty + inQty)
 *
 * Edge cases (all return `prevRate` — an issue never re-prices the remaining
 * stock, and a closed position keeps its last known rate):
 *   - `inQty <= 0`  — pure outflow or nil receipt: rate is unchanged.
 *   - `prevQty + inQty <= 0` — position fully consumed / net non-positive:
 *     keep the last rate rather than divide by zero or invent a number.
 *
 * With `prevQty === 0` the result is simply `inRate` (fresh stock sets the rate).
 */
export function movingAverageRate(
  prevQty: number,
  prevRate: number,
  inQty: number,
  inRate: number,
): number {
  if (inQty <= 0) return prevRate
  const newQty = prevQty + inQty
  if (newQty <= 0) return prevRate
  return (prevQty * prevRate + inQty * inRate) / newQty
}
