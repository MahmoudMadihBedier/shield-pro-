import { describe, expect, it } from 'vitest'

import type { ReturnLine } from '../schemas'
import { returnToStockMoves } from '../to-ledger'

describe('returnToStockMoves', () => {
  it('turns each line into one positive move into the given warehouse', () => {
    const lines: ReturnLine[] = [
      { product_id: 'p1', qty: 3 },
      { product_id: 'p2', qty: 1, reason_detail: 'wrong size' },
    ]

    const moves = returnToStockMoves({ lines }, 'wh-main')

    expect(moves).toEqual([
      { productId: 'p1', warehouseId: 'wh-main', qtyChange: 3 },
      { productId: 'p2', warehouseId: 'wh-main', qtyChange: 1 },
    ])
  })

  it('produces exactly one move per line and every qtyChange is positive', () => {
    const lines: ReturnLine[] = [
      { product_id: 'a', qty: 5 },
      { product_id: 'b', qty: 2 },
      { product_id: 'c', qty: 10 },
    ]

    const moves = returnToStockMoves({ lines }, 'wh-x')

    expect(moves).toHaveLength(3)
    for (const move of moves) {
      expect(move.qtyChange).toBeGreaterThan(0)
    }
  })

  it('passes the given warehouseId through to every move', () => {
    const moves = returnToStockMoves({ lines: [{ product_id: 'p1', qty: 1 }] }, 'wh-picked')
    expect(moves.every((m) => m.warehouseId === 'wh-picked')).toBe(true)
  })

  it('returns an empty list for no lines', () => {
    expect(returnToStockMoves({ lines: [] }, 'wh-main')).toEqual([])
  })
})
