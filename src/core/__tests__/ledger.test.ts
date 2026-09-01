import { describe, expect, it } from 'vitest'

import {
  assertBalanced,
  CREDIT,
  DEBIT,
  LedgerError,
  movingAverageRate,
  nextQtyAfter,
} from '../ledger'

/** Run `fn`, return whatever it threw (or `undefined` if it did not throw). */
function thrownBy(fn: () => unknown): unknown {
  try {
    fn()
    return undefined
  } catch (e) {
    return e
  }
}

describe('DEBIT / CREDIT', () => {
  it('builds a debit-only line', () => {
    expect(DEBIT('1200-inventory', 50)).toEqual({ account: '1200-inventory', debit: 50, credit: 0 })
  })

  it('builds a credit-only line', () => {
    expect(CREDIT('2100-payables', 50)).toEqual({ account: '2100-payables', debit: 0, credit: 50 })
  })
})

describe('assertBalanced', () => {
  it('accepts a posting whose debits equal its credits', () => {
    expect(() =>
      assertBalanced([DEBIT('1200', 120.5), CREDIT('4000', 100.5), CREDIT('2300', 20)]),
    ).not.toThrow()
  })

  it('tolerates sub-1e-6 floating-point drift', () => {
    expect(() => assertBalanced([DEBIT('1200', 0.1 + 0.2), CREDIT('4000', 0.3)])).not.toThrow()
  })

  it('throws "unbalanced" when debits and credits differ', () => {
    const e = thrownBy(() => assertBalanced([DEBIT('1200', 100), CREDIT('4000', 90)]))
    expect(e).toBeInstanceOf(LedgerError)
    expect((e as LedgerError).code).toBe('unbalanced')
  })

  it('throws "negative_amount" when a line carries a negative figure', () => {
    const e = thrownBy(() => assertBalanced([DEBIT('1200', -100), CREDIT('4000', -100)]))
    expect(e).toBeInstanceOf(LedgerError)
    expect((e as LedgerError).code).toBe('negative_amount')
  })

  it('treats an empty posting as balanced', () => {
    expect(() => assertBalanced([])).not.toThrow()
  })
})

describe('nextQtyAfter', () => {
  it('adds a signed change to the current quantity', () => {
    expect(nextQtyAfter(10, 5)).toBe(15)
    expect(nextQtyAfter(10, -4)).toBe(6)
  })

  it('clamps a within-tolerance result to exactly zero', () => {
    expect(nextQtyAfter(5, -5)).toBe(0)
  })

  it('throws "negative_stock" when the bin would go below zero', () => {
    const e = thrownBy(() => nextQtyAfter(3, -4))
    expect(e).toBeInstanceOf(LedgerError)
    expect((e as LedgerError).code).toBe('negative_stock')
  })
})

describe('movingAverageRate', () => {
  it('blends previous and incoming stock by quantity', () => {
    // 10 @ 2.00 received against 10 @ 4.00 → 20 @ 3.00
    expect(movingAverageRate(10, 2, 10, 4)).toBe(3)
  })

  it('adopts the incoming rate when there is no previous stock', () => {
    expect(movingAverageRate(0, 0, 25, 7.5)).toBe(7.5)
  })

  it('leaves the rate unchanged on a pure outflow (inQty <= 0)', () => {
    expect(movingAverageRate(8, 3.25, -5, 999)).toBe(3.25)
  })

  it('keeps the last rate when the resulting position is net non-positive', () => {
    // inQty > 0 but prevQty so negative the position stays consumed
    expect(movingAverageRate(-8, 3.25, 5, 10)).toBe(3.25)
  })
})
