import { describe, expect, it } from 'vitest'

import { serializeLines } from '../lines'
import { receiptToStockMoves } from '../to-ledger'
import type { StockReceipt } from '../schemas'

function receipt(overrides: Partial<StockReceipt> = {}): StockReceipt {
  return {
    $id: 'row-1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'SR-2026-00001',
    doc_status: 1,
    branch_id: null,
    created_by: 'user-1',
    amended_from: null,
    posting_datetime: '2026-08-31T00:00:00.000Z',
    remarks: null,
    purchase_order_ref: 'PO-2026-00001',
    supplier_lot_number: 'LOT-42',
    lines: serializeLines([
      { raw_material_id: 'rm-1', qty: 5, unit_price: 10 },
      { raw_material_id: 'rm-2', qty: 2, unit_price: 3.5 },
    ]),
    ...overrides,
  }
}

describe('receiptToStockMoves', () => {
  it('maps each receipt line to a positive move into the raw store', () => {
    expect(receiptToStockMoves(receipt(), 'wh-raw')).toEqual([
      {
        productId: 'rm-1',
        warehouseId: 'wh-raw',
        lotNumber: 'LOT-42',
        qtyChange: 5,
        valuationRate: 10,
      },
      {
        productId: 'rm-2',
        warehouseId: 'wh-raw',
        lotNumber: 'LOT-42',
        qtyChange: 2,
        valuationRate: 3.5,
      },
    ])
  })

  it('uses null lotNumber when the receipt has no supplier lot', () => {
    const moves = receiptToStockMoves(receipt({ supplier_lot_number: null }), 'wh-raw')
    expect(moves.every((move) => move.lotNumber === null)).toBe(true)
  })

  it('returns [] for an empty lines column', () => {
    expect(receiptToStockMoves(receipt({ lines: '' }), 'wh-raw')).toEqual([])
    expect(receiptToStockMoves(receipt({ lines: null }), 'wh-raw')).toEqual([])
  })
})
