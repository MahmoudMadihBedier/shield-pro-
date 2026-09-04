import { describe, expect, it } from 'vitest'

import { invoiceTotals, lineNet, priceInvoiceLine, splitPayment } from '../pricing'
import type { InvoiceLine } from '../schemas'

describe('lineNet', () => {
  it('applies the discount percentage to the base price', () => {
    expect(lineNet(100, 10)).toBe(90)
    expect(lineNet(100, 0)).toBe(100)
    expect(lineNet(100, 100)).toBe(0)
  })
})

describe('priceInvoiceLine', () => {
  const product = { $id: 'p1', base_price: 200, default_discount_pct: 15 }

  it('copies the base price and derives net_price from the clamped discount', () => {
    expect(priceInvoiceLine(product, 2, 10)).toEqual({
      product_id: 'p1',
      qty: 2,
      base_price: 200,
      discount_pct: 10,
      net_price: 180,
    })
  })

  it('clamps the discount to the product ceiling', () => {
    expect(priceInvoiceLine(product, 1, 40).discount_pct).toBe(15)
  })

  it('clamps a negative discount to zero', () => {
    expect(priceInvoiceLine(product, 1, -5).discount_pct).toBe(0)
  })

  it('treats a zero product ceiling as "no ceiling" (customer discount stands)', () => {
    expect(
      priceInvoiceLine({ $id: 'p2', base_price: 100, default_discount_pct: 0 }, 1, 25).discount_pct,
    ).toBe(25)
  })
})

describe('invoiceTotals', () => {
  it('sums gross and net and derives the discount total', () => {
    const lines: InvoiceLine[] = [
      { product_id: 'a', qty: 2, base_price: 100, discount_pct: 10, net_price: 90 },
      { product_id: 'b', qty: 1, base_price: 50, discount_pct: 0, net_price: 50 },
    ]
    expect(invoiceTotals(lines)).toEqual({
      gross_total: 250,
      discount_total: 20,
      net_total: 230,
    })
  })

  it('is zero for no lines', () => {
    expect(invoiceTotals([])).toEqual({ gross_total: 0, discount_total: 0, net_total: 0 })
  })
})

describe('splitPayment', () => {
  it('cash → all settled', () => {
    expect(splitPayment(100, 'cash')).toEqual({
      ok: true,
      value: { cash_amount: 100, credit_amount: 0 },
    })
  })

  it('credit → all receivable', () => {
    expect(splitPayment(100, 'credit')).toEqual({
      ok: true,
      value: { cash_amount: 0, credit_amount: 100 },
    })
  })

  it('post_dated_cheque → all receivable', () => {
    expect(splitPayment(100, 'post_dated_cheque')).toEqual({
      ok: true,
      value: { cash_amount: 0, credit_amount: 100 },
    })
  })

  it('bank_transfer → all settled when a reference is given', () => {
    expect(splitPayment(100, 'bank_transfer', undefined, 'TRX-9')).toEqual({
      ok: true,
      value: { cash_amount: 100, credit_amount: 0 },
    })
  })

  it('bank_transfer → validation error without a reference', () => {
    const res = splitPayment(100, 'bank_transfer')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('validation')
  })

  it('partial → splits cash and remainder', () => {
    expect(splitPayment(100, 'partial', 30)).toEqual({
      ok: true,
      value: { cash_amount: 30, credit_amount: 70 },
    })
  })

  it('partial → rejects a cash amount at or above the total', () => {
    expect(splitPayment(100, 'partial', 100).ok).toBe(false)
    expect(splitPayment(100, 'partial', 0).ok).toBe(false)
  })

  it('rejects an invalid total', () => {
    expect(splitPayment(Number.NaN, 'cash').ok).toBe(false)
  })
})
