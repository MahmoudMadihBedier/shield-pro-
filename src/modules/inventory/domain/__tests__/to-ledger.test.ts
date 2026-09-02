import { describe, expect, it } from 'vitest'

import {
  countAdjustmentToStockMoves,
  transferToStockMoves,
  writeOffToStockMoves,
} from '../to-ledger'
import type { TransferLine, VarianceLine, WriteOffLine } from '../schemas'

describe('transferToStockMoves', () => {
  const lines: TransferLine[] = [
    { product_id: 'p1', qty: 5, lot_number: 'L-1' },
    { product_id: 'p2', qty: 2 },
  ]

  it('emits an OUT then an IN move per line, carrying the lot', () => {
    const moves = transferToStockMoves({
      from_warehouse_id: 'wh-a',
      to_warehouse_id: 'wh-b',
      lines,
    })
    expect(moves).toEqual([
      { productId: 'p1', warehouseId: 'wh-a', lotNumber: 'L-1', qtyChange: -5 },
      { productId: 'p1', warehouseId: 'wh-b', lotNumber: 'L-1', qtyChange: 5 },
      { productId: 'p2', warehouseId: 'wh-a', lotNumber: null, qtyChange: -2 },
      { productId: 'p2', warehouseId: 'wh-b', lotNumber: null, qtyChange: 2 },
    ])
  })

  it('nets to zero across warehouses (conservation)', () => {
    const moves = transferToStockMoves({
      from_warehouse_id: 'wh-a',
      to_warehouse_id: 'wh-b',
      lines,
    })
    expect(moves.reduce((sum, m) => sum + m.qtyChange, 0)).toBe(0)
  })

  it('returns nothing for an empty transfer', () => {
    expect(
      transferToStockMoves({ from_warehouse_id: 'wh-a', to_warehouse_id: 'wh-b', lines: [] }),
    ).toEqual([])
  })
})

describe('writeOffToStockMoves', () => {
  it('emits one negative move per line from the write-off warehouse', () => {
    const lines: WriteOffLine[] = [
      { product_id: 'p1', qty: 3, lot_number: 'L-9' },
      { product_id: 'p2', qty: 1 },
    ]
    expect(writeOffToStockMoves({ warehouse_id: 'wh-a', lines })).toEqual([
      { productId: 'p1', warehouseId: 'wh-a', lotNumber: 'L-9', qtyChange: -3 },
      { productId: 'p2', warehouseId: 'wh-a', lotNumber: null, qtyChange: -1 },
    ])
  })
})

describe('countAdjustmentToStockMoves', () => {
  const variances: VarianceLine[] = [
    { product_id: 'over', recorded_qty: 10, counted_qty: 12, variance: 2 },
    { product_id: 'exact', recorded_qty: 8, counted_qty: 8, variance: 0 },
    { product_id: 'short', recorded_qty: 9, counted_qty: 4, variance: -5 },
  ]

  it('emits the variance itself as the qtyChange and skips zero-variance lines', () => {
    expect(countAdjustmentToStockMoves({ warehouse_id: 'wh-a' }, variances)).toEqual([
      { productId: 'over', warehouseId: 'wh-a', qtyChange: 2 },
      { productId: 'short', warehouseId: 'wh-a', qtyChange: -5 },
    ])
  })

  it('returns nothing when the count matches the record exactly', () => {
    expect(
      countAdjustmentToStockMoves({ warehouse_id: 'wh-a' }, [
        { product_id: 'exact', recorded_qty: 8, counted_qty: 8, variance: 0 },
      ]),
    ).toEqual([])
  })
})
