import { describe, expect, it } from 'vitest'

import { closeoutOutcomeStatus, custodyIdentity, reconcileCloseout } from '../closeout'
import type { CloseoutActual, CloseoutExpected } from '../schemas'

describe('custodyIdentity', () => {
  it('is true when issued === sold + returned + remaining', () => {
    expect(custodyIdentity(10, 6, 1, 3)).toBe(true)
  })

  it('is false when the figures do not close', () => {
    expect(custodyIdentity(10, 6, 1, 2)).toBe(false)
  })
})

const expected: CloseoutExpected = {
  products: [
    { product_id: 'p1', issued: 10, sold: 6, returned: 1, remaining: 3 },
    { product_id: 'p2', issued: 4, sold: 4, returned: 0, remaining: 0 },
  ],
  cash: [
    { method: 'cash', amount: 600 },
    { method: 'bank_transfer', amount: 200 },
  ],
}

describe('reconcileCloseout', () => {
  it('reports zero variance and no flags when everything ties out', () => {
    const actual: CloseoutActual = {
      products: [
        { product_id: 'p1', counted: 3 },
        { product_id: 'p2', counted: 0 },
      ],
      cash: [
        { method: 'cash', amount: 600 },
        { method: 'bank_transfer', amount: 200 },
      ],
    }
    expect(reconcileCloseout(expected, actual)).toEqual({
      stock_variance: 0,
      cash_variance: 0,
      flags: [],
    })
  })

  it('flags a short physical count and a cash shortfall', () => {
    const actual: CloseoutActual = {
      products: [
        { product_id: 'p1', counted: 1 },
        { product_id: 'p2', counted: 0 },
      ],
      cash: [
        { method: 'cash', amount: 550 },
        { method: 'bank_transfer', amount: 200 },
      ],
    }
    const result = reconcileCloseout(expected, actual)
    expect(result.stock_variance).toBe(-2)
    expect(result.cash_variance).toBe(-50)
    expect(result.flags).toContain('stock:p1:-2')
    expect(result.flags).toContain('cash:cash:-50')
    expect(closeoutOutcomeStatus(result)).toBe('flagged')
  })

  it('flags a broken custody identity', () => {
    const brokenExpected: CloseoutExpected = {
      products: [{ product_id: 'p1', issued: 10, sold: 6, returned: 1, remaining: 1 }],
      cash: [],
    }
    const actual: CloseoutActual = {
      products: [{ product_id: 'p1', counted: 1 }],
      cash: [],
    }
    const result = reconcileCloseout(brokenExpected, actual)
    expect(result.flags.some((f) => f.startsWith('custody:p1'))).toBe(true)
  })

  it('flags unexplained stock the rep still holds', () => {
    const actual: CloseoutActual = {
      products: [
        { product_id: 'p1', counted: 3 },
        { product_id: 'p2', counted: 0 },
        { product_id: 'ghost', counted: 5 },
      ],
      cash: expected.cash,
    }
    const result = reconcileCloseout(expected, actual)
    expect(result.flags).toContain('stock:ghost:5')
    expect(result.stock_variance).toBe(5)
  })

  it('confirmed when there are no flags', () => {
    expect(closeoutOutcomeStatus({ stock_variance: 0, cash_variance: 0, flags: [] })).toBe(
      'confirmed',
    )
  })
})
