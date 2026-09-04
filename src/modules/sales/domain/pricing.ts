/**
 * Invoice pricing — the pure money maths for the `sales` module.
 *
 * Price-stability rule (`IMPLEMENTATION_PLAN.md` §1 rule 4): the admin-set
 * `product.base_price` is never overridden anywhere. The ONLY lever on what a
 * customer pays is a discount percentage, and a rep can never exceed the
 * product's `default_discount_pct` ceiling (0 = no product-level ceiling, so the
 * value passed in — typically the customer's `discount_pct` — stands).
 *
 * `domain` is pure TypeScript — `@/core` (framework-free) is allowed.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'

import type { InvoiceLine, PaymentMethod } from './schemas'

/** Round to whole cents so float drift never leaks into a stored total. */
function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Per-unit price after discount: `base_price * (1 - pct/100)`. Pure formula. */
export function lineNet(base_price: number, discount_pct: number): number {
  return base_price * (1 - discount_pct / 100)
}

/** The product fields pricing needs (a subset of the admin `Product` row). */
export interface PricebookProduct {
  $id: string
  base_price: number
  default_discount_pct: number
}

/**
 * Build a full `InvoiceLine` for `product` at `qty`, applying `discountPct`
 * clamped to `[0, ceiling]` where `ceiling = product.default_discount_pct` when
 * set (> 0), otherwise 100 (no product-level ceiling).
 */
export function priceInvoiceLine(
  product: PricebookProduct,
  qty: number,
  discountPct: number,
): InvoiceLine {
  const base_price = product.base_price
  const ceiling = product.default_discount_pct > 0 ? product.default_discount_pct : 100
  const discount_pct = clamp(Number.isFinite(discountPct) ? discountPct : 0, 0, ceiling)
  const net_price = money(lineNet(base_price, discount_pct))
  return { product_id: product.$id, qty, base_price, discount_pct, net_price }
}

export interface InvoiceTotals {
  gross_total: number
  discount_total: number
  net_total: number
}

/** Totals across all lines: gross = Σ qty·base_price, net = Σ qty·net_price. */
export function invoiceTotals(lines: readonly InvoiceLine[]): InvoiceTotals {
  let gross = 0
  let net = 0
  for (const line of lines) {
    gross += line.qty * line.base_price
    net += line.qty * line.net_price
  }
  const gross_total = money(gross)
  const net_total = money(net)
  return { gross_total, discount_total: money(gross_total - net_total), net_total }
}

export interface PaymentSplit {
  cash_amount: number
  credit_amount: number
}

/**
 * Split `net_total` into a settled (`cash_amount`) and a receivable
 * (`credit_amount`) portion, validated per method:
 *  - `cash`              → all settled
 *  - `credit`            → all receivable
 *  - `bank_transfer`     → all settled, requires a non-empty `bankReference`
 *  - `partial`           → `0 < cashAmount < net_total`, remainder receivable
 *  - `post_dated_cheque` → all receivable
 */
export function splitPayment(
  net_total: number,
  method: PaymentMethod,
  cashAmount?: number,
  bankReference?: string | null,
): Result<PaymentSplit> {
  if (!(net_total >= 0) || !Number.isFinite(net_total)) {
    return err(appError('validation', 'إجمالي الفاتورة غير صالح.'))
  }
  const total = money(net_total)

  switch (method) {
    case 'cash':
      return ok({ cash_amount: total, credit_amount: 0 })
    case 'credit':
    case 'post_dated_cheque':
      return ok({ cash_amount: 0, credit_amount: total })
    case 'bank_transfer':
      if (!bankReference || bankReference.trim() === '') {
        return err(appError('validation', 'التحويل البنكي يتطلب إدخال مرجع الحوالة.'))
      }
      return ok({ cash_amount: total, credit_amount: 0 })
    case 'partial': {
      const cash = money(cashAmount ?? 0)
      if (!(cash > 0) || !(cash < total)) {
        return err(
          appError(
            'validation',
            'الدفع الجزئي: المبلغ النقدي يجب أن يكون أكبر من صفر وأقل من إجمالي الفاتورة.',
          ),
        )
      }
      return ok({ cash_amount: cash, credit_amount: money(total - cash) })
    }
    default: {
      const exhaustive: never = method
      return err(appError('validation', `طريقة دفع غير معروفة: ${String(exhaustive)}`))
    }
  }
}
