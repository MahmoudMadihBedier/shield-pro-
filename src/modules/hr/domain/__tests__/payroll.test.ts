import { describe, expect, it } from 'vitest'

import {
  buildPayrollLines,
  buildPayrollLinesFromFacts,
  computeNetPay,
  parsePayrollLines,
  payrollTotal,
  serializePayrollLines,
} from '../payroll'

describe('computeNetPay', () => {
  it('sums base salary plus incentives minus deductions', () => {
    expect(computeNetPay(1000, 200, 100)).toBe(1100)
  })

  it('clamps a negative result at 0', () => {
    expect(computeNetPay(100, 0, 500)).toBe(0)
  })

  it('returns exactly 0 when deductions equal earnings', () => {
    expect(computeNetPay(500, 0, 500)).toBe(0)
  })
})

describe('buildPayrollLines', () => {
  it('builds one line per employee, defaulting missing incentives/deductions to 0', () => {
    const lines = buildPayrollLines(
      [
        { userId: 'u1', baseSalary: 1000 },
        { userId: 'u2', baseSalary: 2000 },
      ],
      new Map([['u1', 100]]),
      new Map([['u2', 50]]),
    )

    expect(lines).toEqual([
      { user_id: 'u1', base_salary: 1000, incentives: 100, deductions: 0, net_pay: 1100 },
      { user_id: 'u2', base_salary: 2000, incentives: 0, deductions: 50, net_pay: 1950 },
    ])
  })

  it('returns an empty array for an empty roster', () => {
    expect(buildPayrollLines([], new Map(), new Map())).toEqual([])
  })
})

describe('payrollTotal', () => {
  it('sums net_pay across lines', () => {
    const total = payrollTotal([
      { user_id: 'u1', base_salary: 1000, incentives: 0, deductions: 0, net_pay: 1000 },
      { user_id: 'u2', base_salary: 2000, incentives: 0, deductions: 0, net_pay: 1950 },
    ])
    expect(total).toBe(2950)
  })

  it('returns 0 for no lines', () => {
    expect(payrollTotal([])).toBe(0)
  })
})

describe('buildPayrollLinesFromFacts', () => {
  it('sums every active rule that meets its threshold into incentives', () => {
    const lines = buildPayrollLinesFromFacts(
      [{ userId: 'u1', baseSalary: 1000, facts: { attendanceDays: 25, unitsProduced: 200 }, deductions: 0 }],
      [
        { kind: 'attendance_bonus', predicate: { minAttendanceDays: 20, flatAmount: 100 }, amountOrPct: 100 },
        { kind: 'production_bonus', predicate: { minUnitsProduced: 500, flatAmount: 50 }, amountOrPct: 50 },
      ],
    )
    expect(lines).toEqual([
      { user_id: 'u1', base_salary: 1000, incentives: 100, deductions: 0, net_pay: 1100 },
    ])
  })

  it('returns base salary only when no rule is provided', () => {
    const lines = buildPayrollLinesFromFacts(
      [{ userId: 'u1', baseSalary: 1000, facts: {}, deductions: 50 }],
      [],
    )
    expect(lines).toEqual([
      { user_id: 'u1', base_salary: 1000, incentives: 0, deductions: 50, net_pay: 950 },
    ])
  })
})

describe('serializePayrollLines / parsePayrollLines', () => {
  it('round-trips lines through JSON', () => {
    const lines = [{ user_id: 'u1', base_salary: 1000, incentives: 0, deductions: 0, net_pay: 1000 }]
    expect(parsePayrollLines(serializePayrollLines(lines))).toEqual(lines)
  })

  it('returns an empty array for a null/empty column', () => {
    expect(parsePayrollLines(null)).toEqual([])
    expect(parsePayrollLines('')).toEqual([])
  })

  it('throws on malformed JSON', () => {
    expect(() => parsePayrollLines('{not json')).toThrow()
  })

  it('throws when the parsed JSON fails line validation', () => {
    expect(() => parsePayrollLines('[{"user_id":"u1"}]')).toThrow()
  })
})
