import { describe, expect, it } from 'vitest'

import { groupByWarehouse, valuationToRows, type ValuationReport } from '../valuation'

const row = (warehouseId: string, productId: string, qty: number, unitCost: number) => ({
  warehouseId,
  productId,
  qty,
  unitCost,
  value: qty * unitCost,
  hasCost: unitCost > 0,
})

describe('groupByWarehouse', () => {
  it('groups rows by warehouse with per-warehouse subtotals, first-seen order', () => {
    const groups = groupByWarehouse([
      row('W1', 'P1', 10, 5),
      row('W1', 'P2', 2, 100),
      row('W2', 'P1', 4, 5),
    ])
    expect(groups.map((g) => [g.warehouseId, g.subtotal, g.rows.length])).toEqual([
      ['W1', 250, 2],
      ['W2', 20, 1],
    ])
  })

  it('is empty for no rows', () => {
    expect(groupByWarehouse([])).toEqual([])
  })
})

describe('valuationToRows', () => {
  it('resolves ids to names and keeps qty / unit_cost / value', () => {
    const report: ValuationReport = {
      rows: [row('W1', 'P1', 3, 7)],
      totalValue: 21,
      lineCount: 1,
      uncostedLineCount: 0,
    }
    expect(
      valuationToRows(report, {
        warehouse: (id) => (id === 'W1' ? 'المخزن الرئيسي' : id),
        product: (id) => (id === 'P1' ? 'عسل خام' : id),
      }),
    ).toEqual([
      { warehouse: 'المخزن الرئيسي', product: 'عسل خام', qty: 3, unit_cost: 7, value: 21 },
    ])
  })
})
