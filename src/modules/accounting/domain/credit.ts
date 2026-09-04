/**
 * Customer credit-limit check (Implementation Plan Phase 2, Story 2.5).
 *
 * A sale is blocked when `outstanding + newAmount > creditLimit`. Exactly at
 * the limit is allowed. The System Admin may override a block; the override is
 * logged (that logging lives in the sale/submit path, not here).
 *
 * This is the single source of the rule — `@/modules/sales` imports
 * `creditCheck` from the accounting module rather than re-implementing it.
 *
 * Pure — no framework imports.
 */

export interface CreditCheckInput {
  /** The customer's `credit_limit` (0 means "no credit — cash only"). */
  creditLimit: number
  /** Current receivables balance for the customer (see `customerAging`). */
  outstanding: number
  /** The amount of the sale being attempted. */
  newAmount: number
}

export interface CreditCheckResult {
  /** `true` when the sale is within the limit (or exactly at it). */
  ok: boolean
  /** `creditLimit − outstanding` before the new sale. May be negative. */
  available: number
  /** How far `outstanding + newAmount` exceeds `creditLimit`; `0` when `ok`. */
  overBy: number
}

export function creditCheck({
  creditLimit,
  outstanding,
  newAmount,
}: CreditCheckInput): CreditCheckResult {
  const available = creditLimit - outstanding
  const projected = outstanding + newAmount
  const ok = projected <= creditLimit
  return {
    ok,
    available,
    overBy: ok ? 0 : projected - creditLimit,
  }
}

/** `true` when the sale can only proceed with an Admin override. */
export function requiresOverride(result: CreditCheckResult): boolean {
  return !result.ok
}
