import { describe, expect, it } from 'vitest'

import {
  bottomProducts,
  branchPerformance,
  grossMargin,
  monthlySalesTrend,
  repPerformance,
  topProducts,
} from '../sales-performance'

describe('topProducts', () => {
  it('aggregates units + revenue per product, sorted desc by net revenue', () => {
    const lines = [
      { product_id: 'p1', qty: 2, net_price: 10 }, // 20
      { product_id: 'p2', qty: 1, net_price: 50 }, // 50
      { product_id: 'p1', qty: 3, net_price: 10 }, // +30 = 50
    ]
    const rows = topProducts(lines)
    expect(rows).toHaveLength(2)
    // p1 and p2 both total 50 — stable sort keeps first-seen (p1) first on a tie.
    expect(rows.map((r) => r.productId)).toEqual(['p1', 'p2'])
    expect(rows[0]).toEqual({ productId: 'p1', unitsSold: 5, netRevenue: 50 })
  })

  it('respects the limit option', () => {
    const lines = [
      { product_id: 'p1', qty: 1, net_price: 30 },
      { product_id: 'p2', qty: 1, net_price: 20 },
      { product_id: 'p3', qty: 1, net_price: 10 },
    ]
    expect(topProducts(lines, { limit: 2 }).map((r) => r.productId)).toEqual(['p1', 'p2'])
  })

  it('returns an empty array for empty input', () => {
    expect(topProducts([])).toEqual([])
  })
})

describe('bottomProducts', () => {
  it('excludes zero-sales products and sorts ascending by net revenue', () => {
    const lines = [
      { product_id: 'p1', qty: 1, net_price: 30 },
      { product_id: 'p2', qty: 1, net_price: 5 },
    ]
    const rows = bottomProducts(lines)
    expect(rows.map((r) => r.productId)).toEqual(['p2', 'p1'])
  })

  it('returns an empty array for empty input', () => {
    expect(bottomProducts([])).toEqual([])
  })
})

describe('branchPerformance', () => {
  it('groups by branch and sums revenue + invoice count', () => {
    const rows = branchPerformance([
      { branch_id: 'b1', net_total: 100 },
      { branch_id: 'b1', net_total: 50 },
      { branch_id: 'b2', net_total: 200 },
    ])
    expect(rows).toEqual([
      { branchId: 'b2', netRevenue: 200, invoiceCount: 1 },
      { branchId: 'b1', netRevenue: 150, invoiceCount: 2 },
    ])
  })

  it('groups a null branch_id under "unassigned"', () => {
    const rows = branchPerformance([{ branch_id: null, net_total: 40 }])
    expect(rows).toEqual([{ branchId: 'unassigned', netRevenue: 40, invoiceCount: 1 }])
  })
})

describe('repPerformance', () => {
  it('groups by rep and sums revenue + invoice count', () => {
    const rows = repPerformance([
      { rep_user_id: 'r1', net_total: 10 },
      { rep_user_id: 'r2', net_total: 90 },
      { rep_user_id: 'r1', net_total: 5 },
    ])
    expect(rows).toEqual([
      { repUserId: 'r2', netRevenue: 90, invoiceCount: 1 },
      { repUserId: 'r1', netRevenue: 15, invoiceCount: 2 },
    ])
  })
})

describe('grossMargin', () => {
  it('computes (net - cogs) / net', () => {
    expect(grossMargin(100, 60)).toBeCloseTo(0.4)
  })

  it('returns 0 when net revenue is zero (no divide-by-zero)', () => {
    expect(grossMargin(0, 0)).toBe(0)
  })
})

describe('monthlySalesTrend', () => {
  it('buckets by YYYY-MM and fills gaps with 0 for the trailing window', () => {
    const invoices = [
      { posting_datetime: '2026-06-15T00:00:00.000Z', net_total: 100 },
      { posting_datetime: '2026-08-01T00:00:00.000Z', net_total: 50 },
      { posting_datetime: '2026-08-20T00:00:00.000Z', net_total: 25 },
    ]
    const trend = monthlySalesTrend(invoices, 3)
    expect(trend).toEqual([
      { month: '2026-06', netRevenue: 100 },
      { month: '2026-07', netRevenue: 0 },
      { month: '2026-08', netRevenue: 75 },
    ])
  })

  it('windows off "now" when there are no invoices', () => {
    const trend = monthlySalesTrend([], 2)
    expect(trend).toHaveLength(2)
    expect(trend.every((m) => m.netRevenue === 0)).toBe(true)
  })

  it('sorts chronologically regardless of input order', () => {
    const invoices = [
      { posting_datetime: '2026-08-01T00:00:00.000Z', net_total: 1 },
      { posting_datetime: '2026-06-01T00:00:00.000Z', net_total: 2 },
    ]
    const trend = monthlySalesTrend(invoices, 3)
    expect(trend.map((m) => m.month)).toEqual(['2026-06', '2026-07', '2026-08'])
  })
})
