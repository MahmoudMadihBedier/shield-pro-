import { describe, expect, it } from 'vitest'

import { roundCents } from '../money'

describe('roundCents', () => {
  it('snaps binary float drift to clean cents', () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3)
    expect(roundCents(1.005)).toBe(1.01)
    expect(roundCents(19.99 * 3)).toBe(59.97)
  })

  it('leaves already-clean values untouched', () => {
    expect(roundCents(0)).toBe(0)
    expect(roundCents(1234.56)).toBe(1234.56)
    expect(roundCents(-42.5)).toBe(-42.5)
  })

  it('rounds a residual sliver to exactly zero', () => {
    expect(roundCents(1e-13)).toBe(0)
    expect(roundCents(-1e-13)).toBe(0)
  })

  it('rounds half up, toward positive infinity', () => {
    expect(roundCents(2.345)).toBe(2.35)
    expect(roundCents(-2.345)).toBe(-2.34)
  })

  it('passes non-finite values through', () => {
    expect(roundCents(Number.NaN)).toBeNaN()
    expect(roundCents(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
  })
})
