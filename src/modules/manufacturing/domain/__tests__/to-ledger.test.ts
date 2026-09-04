import { describe, expect, it } from 'vitest'

import { batchToStockMoves, type BatchForLedger } from '../to-ledger'

const warehouses = {
  factoryCustodyWarehouseId: 'wh-factory',
  rawStoreWarehouseId: 'wh-raw',
}

const batch: BatchForLedger = {
  product_id: 'prod-1',
  lot_number: 'LOT-A',
  produced_qty: 100,
  expected_cost: 400,
  raw_material_lots: [
    { purchase_order_ref: 'PO-1', qty_consumed: 10 },
    { purchase_order_ref: 'PO-2', qty_consumed: 4 },
  ],
}

describe('batchToStockMoves', () => {
  it('emits one OUT move per consumed lot plus one finished-product IN move', () => {
    expect(batchToStockMoves(batch, warehouses)).toHaveLength(3)
  })

  it('makes every raw-lot move a negative change out of the raw store', () => {
    const moves = batchToStockMoves(batch, warehouses)
    expect(moves.slice(0, 2)).toEqual([
      { productId: 'PO-1', warehouseId: 'wh-raw', qtyChange: -10 },
      { productId: 'PO-2', warehouseId: 'wh-raw', qtyChange: -4 },
    ])
  })

  it('makes the finished move a positive change into factory custody with the lot number and unit rate', () => {
    const finished = batchToStockMoves(batch, warehouses).at(-1)
    expect(finished).toEqual({
      productId: 'prod-1',
      warehouseId: 'wh-factory',
      lotNumber: 'LOT-A',
      qtyChange: 100,
      valuationRate: 4,
    })
  })

  it('uses a zero valuation rate when nothing was produced', () => {
    const finished = batchToStockMoves({ ...batch, produced_qty: 0 }, warehouses).at(-1)
    expect(finished?.valuationRate).toBe(0)
  })

  it('returns only the finished move when no lots were consumed', () => {
    const moves = batchToStockMoves({ ...batch, raw_material_lots: [] }, warehouses)
    expect(moves).toHaveLength(1)
    expect(moves[0]?.qtyChange).toBe(100)
  })
})
