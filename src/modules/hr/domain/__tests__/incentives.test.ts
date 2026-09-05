import { describe, expect, it } from 'vitest'

import {
  evaluateIncentive,
  parseIncentivePredicate,
  serializeIncentivePredicate,
  type IncentiveRuleLike,
} from '../incentives'

describe('parseIncentivePredicate / serializeIncentivePredicate', () => {
  it('round-trips a predicate through JSON', () => {
    const predicate = { ratePct: 5, minSalesAmount: 1000 }
    const raw = serializeIncentivePredicate(predicate)
    expect(parseIncentivePredicate(raw)).toEqual(predicate)
  })

  it('returns an empty object for a null/empty column', () => {
    expect(parseIncentivePredicate(null)).toEqual({})
    expect(parseIncentivePredicate('')).toEqual({})
  })

  it('returns an empty object for malformed JSON', () => {
    expect(parseIncentivePredicate('{not json')).toEqual({})
  })
})

describe('evaluateIncentive', () => {
  it('sales_commission: pays the rate when the sales threshold is met', () => {
    const rule: IncentiveRuleLike = {
      kind: 'sales_commission',
      predicate: { minSalesAmount: 1000, ratePct: 5 },
      amountOrPct: 5,
    }
    expect(evaluateIncentive(rule, { salesAmount: 2000 })).toBe(100)
  })

  it('sales_commission: pays 0 when the sales threshold is not met', () => {
    const rule: IncentiveRuleLike = {
      kind: 'sales_commission',
      predicate: { minSalesAmount: 1000, ratePct: 5 },
      amountOrPct: 5,
    }
    expect(evaluateIncentive(rule, { salesAmount: 500 })).toBe(0)
  })

  it('production_bonus: pays the flat amount when units threshold is met', () => {
    const rule: IncentiveRuleLike = {
      kind: 'production_bonus',
      predicate: { minUnitsProduced: 100, flatAmount: 250 },
      amountOrPct: 250,
    }
    expect(evaluateIncentive(rule, { unitsProduced: 150 })).toBe(250)
  })

  it('production_bonus: pays 0 when units threshold is not met', () => {
    const rule: IncentiveRuleLike = {
      kind: 'production_bonus',
      predicate: { minUnitsProduced: 100, flatAmount: 250 },
      amountOrPct: 250,
    }
    expect(evaluateIncentive(rule, { unitsProduced: 50 })).toBe(0)
  })

  it('attendance_bonus: pays the flat amount when attendance threshold is met', () => {
    const rule: IncentiveRuleLike = {
      kind: 'attendance_bonus',
      predicate: { minAttendanceDays: 20, flatAmount: 300 },
      amountOrPct: 300,
    }
    expect(evaluateIncentive(rule, { attendanceDays: 22 })).toBe(300)
  })

  it('attendance_bonus: pays 0 when attendance threshold is not met', () => {
    const rule: IncentiveRuleLike = {
      kind: 'attendance_bonus',
      predicate: { minAttendanceDays: 20, flatAmount: 300 },
      amountOrPct: 300,
    }
    expect(evaluateIncentive(rule, { attendanceDays: 10 })).toBe(0)
  })

  it('falls back to amountOrPct when the predicate omits its own rate/amount', () => {
    const rule: IncentiveRuleLike = { kind: 'attendance_bonus', predicate: {}, amountOrPct: 150 }
    expect(evaluateIncentive(rule, { attendanceDays: 5 })).toBe(150)
  })

  it('pays 0 for an inactive rule even when the threshold is met', () => {
    const rule: IncentiveRuleLike = {
      kind: 'attendance_bonus',
      predicate: { minAttendanceDays: 5, flatAmount: 150 },
      amountOrPct: 150,
      isActive: false,
    }
    expect(evaluateIncentive(rule, { attendanceDays: 20 })).toBe(0)
  })
})
