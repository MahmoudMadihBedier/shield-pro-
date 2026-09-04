import { describe, expect, it } from 'vitest'

import { expectedCost, expectedProfit, wasteRatio, wasteWithinAllowance } from '../costing'
import type { RawMaterialLot } from '../schemas'

const lots: RawMaterialLot[] = [
  { purchase_order_ref: 'PO-1', qty_consumed: 10 },
  { purchase_order_ref: 'PO-2', qty_consumed: 4 },
]

describe('expectedCost', () => {
  it('sums qty_consumed × unit price across lots', () => {
    const prices = new Map([
      ['PO-1', 2],
      ['PO-2', 5],
    ])
    expect(expectedCost(lots, prices)).toBe(40)
  })

  it('treats an unknown lot key as zero cost', () => {
    expect(expectedCost(lots, new Map([['PO-1', 2]]))).toBe(20)
  })

  it('is zero for no lots', () => {
    expect(expectedCost([], new Map())).toBe(0)
  })
})

describe('expectedProfit', () => {
  it('is revenue minus cost', () => {
    expect(expectedProfit(95, 10, 400)).toBe(550)
  })

  it('is the negative cost when nothing was produced', () => {
    expect(expectedProfit(0, 10, 400)).toBe(-400)
  })
})

describe('wasteRatio', () => {
  it('is waste over total output', () => {
    expect(wasteRatio(95, 5)).toBe(0.05)
  })

  it('is zero when there is no output at all', () => {
    expect(wasteRatio(0, 0)).toBe(0)
  })
})

describe('wasteWithinAllowance', () => {
  it('is true below the allowance', () => {
    expect(wasteWithinAllowance(0.03, 5)).toBe(true)
  })

  it('is true exactly at the boundary', () => {
    expect(wasteWithinAllowance(0.05, 5)).toBe(true)
  })

  it('is false above the allowance', () => {
    expect(wasteWithinAllowance(0.06, 5)).toBe(false)
  })
})
