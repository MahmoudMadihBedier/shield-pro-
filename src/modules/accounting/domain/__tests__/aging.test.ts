import { describe, expect, it } from 'vitest'

import {
  bucketFor,
  customerAging,
  overdueTotal,
  type AgingInvoice,
  type AgingReceipt,
} from '../aging'

describe('bucketFor', () => {
  it('places whole-day ages on the right side of every boundary', () => {
    expect(bucketFor(0)).toBe('0-30')
    expect(bucketFor(30)).toBe('0-30')
    expect(bucketFor(31)).toBe('31-60')
    expect(bucketFor(60)).toBe('31-60')
    expect(bucketFor(61)).toBe('61-90')
    expect(bucketFor(90)).toBe('61-90')
    expect(bucketFor(91)).toBe('90+')
    expect(bucketFor(400)).toBe('90+')
  })

  it('treats a future-dated (negative) age as the youngest bucket', () => {
    expect(bucketFor(-5)).toBe('0-30')
  })
})

const asOf = new Date('2026-09-01T00:00:00.000Z')

function invoice(over: Partial<AgingInvoice> = {}): AgingInvoice {
  return {
    customer_id: 'c1',
    net_total: 100,
    payment_method: 'credit',
    posting_datetime: '2026-08-20T00:00:00.000Z', // 12 days before asOf
    doc_status: 1,
    ...over,
  }
}

describe('customerAging', () => {
  it('excludes drafts, cancelled, and non-credit invoices', () => {
    const invoices: AgingInvoice[] = [
      invoice({ doc_status: 0 }),
      invoice({ doc_status: 2 }),
      invoice({ payment_method: 'cash' }),
      invoice({ payment_method: 'bank_transfer' }),
    ]
    expect(customerAging(invoices, [], asOf)).toEqual([])
  })

  it('ages a multi-invoice customer by invoice date', () => {
    const invoices: AgingInvoice[] = [
      invoice({ net_total: 100, posting_datetime: '2026-08-25T00:00:00.000Z' }), // 7 days -> 0-30
      invoice({ net_total: 200, posting_datetime: '2026-07-20T00:00:00.000Z' }), // 43 days -> 31-60
      invoice({ net_total: 400, posting_datetime: '2026-05-01T00:00:00.000Z' }), // 123 days -> 90+
    ]
    const row = customerAging(invoices, [], asOf)[0]!
    expect(row.outstanding).toBe(700)
    expect(row.buckets).toEqual({ '0-30': 100, '31-60': 200, '61-90': 0, '90+': 400 })
    expect(row.oldestDays).toBe(123)
  })

  it('applies receipts oldest-invoice-first so the aged remainder is correct', () => {
    const invoices: AgingInvoice[] = [
      invoice({ net_total: 300, posting_datetime: '2026-05-01T00:00:00.000Z' }), // oldest, 90+
      invoice({ net_total: 200, posting_datetime: '2026-08-25T00:00:00.000Z' }), // newest, 0-30
    ]
    const receipts: AgingReceipt[] = [{ customer_id: 'c1', amount: 350 }]
    const row = customerAging(invoices, receipts, asOf)[0]!
    // 350 clears the 300 oldest, then 50 off the newest -> 150 remains in 0-30
    expect(row.outstanding).toBe(150)
    expect(row.buckets).toEqual({ '0-30': 150, '31-60': 0, '61-90': 0, '90+': 0 })
    expect(row.oldestDays).toBe(7)
  })

  it('reports a negative outstanding and zero buckets when a customer overpaid', () => {
    const row = customerAging(
      [invoice({ net_total: 100 })],
      [{ customer_id: 'c1', amount: 130 }],
      asOf,
    )[0]!
    expect(row.outstanding).toBe(-30)
    expect(row.buckets).toEqual({ '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 })
    expect(row.oldestDays).toBe(0)
  })

  it('is sensitive to the as-of date', () => {
    const invoices = [invoice({ net_total: 100, posting_datetime: '2026-08-20T00:00:00.000Z' })]
    const early = customerAging(invoices, [], new Date('2026-08-25T00:00:00.000Z'))[0]!
    const late = customerAging(invoices, [], new Date('2026-12-15T00:00:00.000Z'))[0]!
    expect(early.buckets['0-30']).toBe(100)
    expect(late.buckets['90+']).toBe(100)
  })
})

describe('overdueTotal', () => {
  it('sums everything past 30 days', () => {
    expect(overdueTotal({ buckets: { '0-30': 10, '31-60': 5, '61-90': 3, '90+': 2 } })).toBe(10)
  })
})
