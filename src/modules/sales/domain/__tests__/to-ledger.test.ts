import { describe, expect, it } from 'vitest'

import { assertBalanced } from '@/core/ledger'

import {
  invoiceToGlLines,
  invoiceToStockMoves,
  repIssueToStockMoves,
  SALES_ACCOUNTS,
} from '../to-ledger'
import { serializeJsonArray } from '../schemas'

const invoiceLines = serializeJsonArray([
  { product_id: 'p1', qty: 2, base_price: 100, discount_pct: 10, net_price: 90 },
  { product_id: 'p2', qty: 1, base_price: 50, discount_pct: 0, net_price: 50 },
])

describe('invoiceToStockMoves', () => {
  it('emits one negative move per line out of rep custody, valued at net_price', () => {
    expect(invoiceToStockMoves({ lines: invoiceLines }, 'wh-rep')).toEqual([
      { productId: 'p1', warehouseId: 'wh-rep', qtyChange: -2, valuationRate: 90 },
      { productId: 'p2', warehouseId: 'wh-rep', qtyChange: -1, valuationRate: 50 },
    ])
  })
})

describe('invoiceToGlLines', () => {
  it('cash sale: Dr cash, Cr sales — balanced, two lines', () => {
    const lines = invoiceToGlLines({
      net_total: 230,
      cash_amount: 230,
      credit_amount: 0,
      payment_method: 'cash',
    })
    expect(lines).toEqual([
      { account: SALES_ACCOUNTS.cash, debit: 230, credit: 0 },
      { account: SALES_ACCOUNTS.salesRevenue, debit: 0, credit: 230 },
    ])
    expect(() => assertBalanced(lines)).not.toThrow()
  })

  it('partial sale: Dr cash + Dr AR, Cr sales — balanced, three lines', () => {
    const lines = invoiceToGlLines({
      net_total: 230,
      cash_amount: 30,
      credit_amount: 200,
      payment_method: 'partial',
    })
    expect(lines).toHaveLength(3)
    expect(lines).toContainEqual({
      account: SALES_ACCOUNTS.accountsReceivable,
      debit: 200,
      credit: 0,
    })
    expect(() => assertBalanced(lines)).not.toThrow()
  })

  it('bank_transfer settles to the bank account', () => {
    const lines = invoiceToGlLines({
      net_total: 100,
      cash_amount: 100,
      credit_amount: 0,
      payment_method: 'bank_transfer',
    })
    expect(lines[0]!.account).toBe(SALES_ACCOUNTS.bank)
    expect(() => assertBalanced(lines)).not.toThrow()
  })
})

describe('repIssueToStockMoves', () => {
  const issue = {
    lines: serializeJsonArray([
      { product_id: 'p1', qty: 5, lot_number: 'L-1' },
      { product_id: 'p2', qty: 2 },
    ]),
  }

  it('emits an OUT then an IN move per line, carrying the lot', () => {
    expect(repIssueToStockMoves(issue, 'wh-sub', 'wh-rep')).toEqual([
      { productId: 'p1', warehouseId: 'wh-sub', lotNumber: 'L-1', qtyChange: -5 },
      { productId: 'p1', warehouseId: 'wh-rep', lotNumber: 'L-1', qtyChange: 5 },
      { productId: 'p2', warehouseId: 'wh-sub', lotNumber: null, qtyChange: -2 },
      { productId: 'p2', warehouseId: 'wh-rep', lotNumber: null, qtyChange: 2 },
    ])
  })

  it('conserves quantity across the two warehouses', () => {
    const moves = repIssueToStockMoves(issue, 'wh-sub', 'wh-rep')
    expect(moves.reduce((sum, m) => sum + m.qtyChange, 0)).toBe(0)
  })
})
