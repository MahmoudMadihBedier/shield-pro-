import { describe, expect, it } from 'vitest'

import { creditCheck, requiresOverride } from '../credit'

describe('creditCheck', () => {
  it('passes a sale comfortably within the limit', () => {
    const res = creditCheck({ creditLimit: 1000, outstanding: 200, newAmount: 300 })
    expect(res).toEqual({ ok: true, available: 800, overBy: 0 })
    expect(requiresOverride(res)).toBe(false)
  })

  it('passes a sale that lands exactly on the limit', () => {
    const res = creditCheck({ creditLimit: 1000, outstanding: 400, newAmount: 600 })
    expect(res.ok).toBe(true)
    expect(res.overBy).toBe(0)
  })

  it('blocks a sale that exceeds the limit and reports the shortfall', () => {
    const res = creditCheck({ creditLimit: 1000, outstanding: 800, newAmount: 500 })
    expect(res.ok).toBe(false)
    expect(res.available).toBe(200)
    expect(res.overBy).toBe(300)
    expect(requiresOverride(res)).toBe(true)
  })

  it('blocks any credit sale when the customer has a zero limit', () => {
    const res = creditCheck({ creditLimit: 0, outstanding: 0, newAmount: 1 })
    expect(res.ok).toBe(false)
    expect(res.overBy).toBe(1)
  })

  it('reports a negative available balance when already over the limit', () => {
    const res = creditCheck({ creditLimit: 500, outstanding: 700, newAmount: 0 })
    expect(res.available).toBe(-200)
    expect(res.ok).toBe(false)
    expect(res.overBy).toBe(200)
  })
})
