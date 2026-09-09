import { describe, expect, it } from 'vitest'

import {
  daysSinceLastOrder,
  sortBySpend,
  supplierPerformanceToRows,
  type SupplierPerformanceReport,
  type SupplierPerformanceRow,
} from '../supplier-performance'

const row = (over: Partial<SupplierPerformanceRow>): SupplierPerformanceRow => ({
  supplierId: 'S1',
  supplierName: 'Acme',
  orderCount: 1,
  submittedValue: 100,
  avgOrderValue: 100,
  cancelledCount: 0,
  cancelRate: 0,
  firstOrderAt: '2026-01-01T00:00:00Z',
  lastOrderAt: '2026-01-01T00:00:00Z',
  ...over,
})

describe('sortBySpend', () => {
  it('orders by spend desc, then name', () => {
    const sorted = sortBySpend([
      row({ supplierId: 'A', supplierName: 'A', submittedValue: 100 }),
      row({ supplierId: 'B', supplierName: 'B', submittedValue: 300 }),
      row({ supplierId: 'C', supplierName: 'C', submittedValue: 100 }),
    ])
    expect(sorted.map((r) => r.supplierId)).toEqual(['B', 'A', 'C'])
  })

  it('does not mutate the input', () => {
    const input = [row({ submittedValue: 1 }), row({ submittedValue: 2 })]
    sortBySpend(input)
    expect(input.map((r) => r.submittedValue)).toEqual([1, 2])
  })
})

describe('daysSinceLastOrder', () => {
  const now = Date.parse('2026-01-31T00:00:00Z')

  it('counts whole days since the last order', () => {
    expect(daysSinceLastOrder({ lastOrderAt: '2026-01-01T00:00:00Z' }, now)).toBe(30)
  })

  it('is null when there is no last order or the date is unparseable', () => {
    expect(daysSinceLastOrder({ lastOrderAt: null }, now)).toBeNull()
    expect(daysSinceLastOrder({ lastOrderAt: 'nope' }, now)).toBeNull()
  })

  it('never goes negative for a future date', () => {
    expect(daysSinceLastOrder({ lastOrderAt: '2026-02-10T00:00:00Z' }, now)).toBe(0)
  })
})

describe('supplierPerformanceToRows', () => {
  it('flattens sorted rows and renders cancel rate as a percentage', () => {
    const report: SupplierPerformanceReport = {
      rows: [
        row({ supplierId: 'A', supplierName: 'A', submittedValue: 100, cancelRate: 0.25 }),
        row({ supplierId: 'B', supplierName: 'B', submittedValue: 500, cancelledCount: 2 }),
      ],
      totalSpend: 600,
      supplierCount: 2,
    }
    const out = supplierPerformanceToRows(report)
    expect(out.map((r) => r.supplier)).toEqual(['B', 'A'])
    expect(out[1]!.cancel_rate_pct).toBe(25)
  })

  it('snaps spend and avg order value to whole cents for export', () => {
    const report: SupplierPerformanceReport = {
      rows: [row({ submittedValue: 1000, avgOrderValue: 1000 / 3 })],
      totalSpend: 1000,
      supplierCount: 1,
    }
    const [only] = supplierPerformanceToRows(report)
    expect(only!.spend).toBe(1000)
    expect(only!.avg_order_value).toBe(333.33)
  })
})
