/**
 * Data layer for the customer credit-limit check + admin override (Story 2.5).
 * The authoritative computation lives in `supabase/migrations/0009`
 * (`check_customer_credit` / `record_credit_override`); the pure rule is
 * `@/modules/accounting/domain/credit`'s `creditCheck`, still used for local
 * previews. Presentation calls these wrappers, never `@/infrastructure`.
 */
import {
  checkCustomerCredit as callCheck,
  recordCreditOverride as callOverride,
  type CreditCheckResult,
  type CreditOverrideResult,
} from '@/infrastructure/appwrite/functions'
import type { Result } from '@/core/result'

export type { CreditCheckResult, CreditOverrideResult }

/** `outstanding + newAmount` vs the customer's `credit_limit`. */
export function checkCustomerCredit(
  customerId: string,
  newAmount = 0,
): Promise<Result<CreditCheckResult>> {
  return callCheck(customerId, newAmount)
}

/** Admin records a logged, SoD-checked override for an over-limit draft invoice. */
export function recordCreditOverride(
  invoiceRef: string,
  reason: string,
): Promise<Result<CreditOverrideResult>> {
  return callOverride(invoiceRef, reason)
}
