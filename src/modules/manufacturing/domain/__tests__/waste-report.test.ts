import { describe, expect, it } from 'vitest'

import {
  buildProductWasteLookup,
  buildWasteReportRows,
  summarizeWasteReport,
  wasteReportToCsvRows,
} from '../waste-report'
import type { ProductionBatch } from '../schemas'

const batch = (over: Partial<ProductionBatch> = {}): ProductionBatch => ({
  $id: 'b1',
  $createdAt: '2026-03-01T00:00:00Z',
  $updatedAt: '2026-03-01T00:00:00Z',
  reference_id: 'MFB-0001',
  doc_status: 1,
  branch_id: 'br1',
  created_by: 'u1',
  amended_from: null,
  posting_datetime: '2026-03-01T00:00:00Z',
  remarks: null,
  production_request_ref: null,
  product_id: 'p1',
  lot_number: 'L1',
  produced_qty: 90,
  waste_qty: 10,
  raw_material_lots: '[]',
  expected_cost: 0,
  expected_profit: 0,
  qc_status: 'released',
  qc_by: null,
  expiry_date: null,
  ...over,
})

const products = [
  { $id: 'p1', name: 'زبادي', allowed_waste_pct: 15 },
  { $id: 'p2', name: 'جبنة', allowed_waste_pct: 5 },
]

describe('buildProductWasteLookup', () => {
  it('resolves known products and falls back to the id / 0 for unknown ones', () => {
    const lookup = buildProductWasteLookup(products)
    expect(lookup.name('p1')).toBe('زبادي')
    expect(lookup.allowedPct('p1')).toBe(15)
    expect(lookup.name('missing')).toBe('missing')
    expect(lookup.allowedPct('missing')).toBe(0)
  })
})

describe('buildWasteReportRows', () => {
  it('computes the ratio and within-allowance flag per batch', () => {
    const lookup = buildProductWasteLookup(products)
    const [row] = buildWasteReportRows([batch()], lookup)
    expect(row).toMatchObject({
      referenceId: 'MFB-0001',
      productName: 'زبادي',
      ratio: 0.1,
      allowedPct: 15,
      withinAllowance: true,
    })
  })

  it('flags a batch whose waste exceeds the product allowance', () => {
    const lookup = buildProductWasteLookup(products)
    const [row] = buildWasteReportRows(
      [batch({ product_id: 'p2', produced_qty: 80, waste_qty: 20 })],
      lookup,
    )
    expect(row?.withinAllowance).toBe(false)
  })

  it('excludes a batch with zero total output', () => {
    const lookup = buildProductWasteLookup(products)
    const rows = buildWasteReportRows([batch({ produced_qty: 0, waste_qty: 0 })], lookup)
    expect(rows).toEqual([])
  })

  it('sorts newest posting_datetime first', () => {
    const lookup = buildProductWasteLookup(products)
    const rows = buildWasteReportRows(
      [
        batch({ $id: 'b1', posting_datetime: '2026-03-01T00:00:00Z' }),
        batch({ $id: 'b2', posting_datetime: '2026-03-10T00:00:00Z' }),
      ],
      lookup,
    )
    expect(rows.map((r) => r.$id)).toEqual(['b2', 'b1'])
  })
})

describe('summarizeWasteReport', () => {
  it('sums produced/waste and computes the overall ratio, not an average of ratios', () => {
    const lookup = buildProductWasteLookup(products)
    const rows = buildWasteReportRows(
      [
        batch({ $id: 'b1', product_id: 'p1', produced_qty: 90, waste_qty: 10 }), // ratio 0.1, within
        batch({ $id: 'b2', product_id: 'p2', produced_qty: 80, waste_qty: 20 }), // ratio 0.2, exceeds
      ],
      lookup,
    )
    const summary = summarizeWasteReport(rows)
    expect(summary).toEqual({
      batchCount: 2,
      totalProduced: 170,
      totalWaste: 30,
      overallRatio: 0.15,
      exceedingCount: 1,
    })
  })

  it('is all-zero for an empty report', () => {
    expect(summarizeWasteReport([])).toEqual({
      batchCount: 0,
      totalProduced: 0,
      totalWaste: 0,
      overallRatio: 0,
      exceedingCount: 0,
    })
  })
})

describe('wasteReportToCsvRows', () => {
  it('flattens a row to CSV-safe scalars, waste_pct rounded to one decimal', () => {
    const lookup = buildProductWasteLookup(products)
    const rows = buildWasteReportRows([batch({ produced_qty: 3, waste_qty: 1 })], lookup) // 25%
    const [csv] = wasteReportToCsvRows(rows)
    expect(csv).toMatchObject({
      reference_id: 'MFB-0001',
      product: 'زبادي',
      produced_qty: 3,
      waste_qty: 1,
      waste_pct: 25,
      within_allowance: 'لا',
    })
  })
})
