import { describe, expect, it } from 'vitest'

import {
  attendanceDraftSchema,
  attendanceRecordRowSchema,
  incentiveRuleInputSchema,
  incentiveRuleRowSchema,
  payrollLineSchema,
  payrollRunDraftSchema,
  payrollRunRowSchema,
} from '../schemas'

describe('attendanceRecordRowSchema', () => {
  it('accepts a well-formed row', () => {
    const result = attendanceRecordRowSchema.safeParse({
      $id: 'a1',
      $createdAt: '2026-08-01T00:00:00.000Z',
      $updatedAt: '2026-08-01T00:00:00.000Z',
      user_id: 'u1',
      date: '2026-08-01',
      check_in: '2026-08-01T08:00:00.000Z',
      check_out: null,
      status: 'present',
      notes: null,
      branch_id: 'br-1',
      created_by: 'u2',
      created_at: '2026-08-01T08:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid status', () => {
    const result = attendanceRecordRowSchema.safeParse({
      $id: 'a1',
      $createdAt: '2026-08-01T00:00:00.000Z',
      $updatedAt: '2026-08-01T00:00:00.000Z',
      user_id: 'u1',
      date: '2026-08-01',
      status: 'on_vacation',
      created_by: 'u2',
      created_at: '2026-08-01T08:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('attendanceDraftSchema', () => {
  it('rejects a malformed date', () => {
    const result = attendanceDraftSchema.safeParse({
      userId: 'u1',
      date: '08-01-2026',
      status: 'present',
      createdBy: 'u2',
    })
    expect(result.success).toBe(false)
  })

  it('accepts a minimal valid draft', () => {
    const result = attendanceDraftSchema.safeParse({
      userId: 'u1',
      date: '2026-08-01',
      status: 'absent',
      createdBy: 'u2',
    })
    expect(result.success).toBe(true)
  })
})

describe('payrollLineSchema', () => {
  it('rejects negative incentives', () => {
    const result = payrollLineSchema.safeParse({
      user_id: 'u1',
      base_salary: 1000,
      incentives: -1,
      deductions: 0,
      net_pay: 999,
    })
    expect(result.success).toBe(false)
  })

  it('accepts a valid line', () => {
    const result = payrollLineSchema.safeParse({
      user_id: 'u1',
      base_salary: 1000,
      incentives: 100,
      deductions: 50,
      net_pay: 1050,
    })
    expect(result.success).toBe(true)
  })
})

describe('payrollRunRowSchema', () => {
  it('accepts a well-formed row', () => {
    const result = payrollRunRowSchema.safeParse({
      $id: 'p1',
      $createdAt: '2026-08-01T00:00:00.000Z',
      $updatedAt: '2026-08-01T00:00:00.000Z',
      reference_id: 'PAY-2026-00001',
      doc_status: 0,
      branch_id: null,
      created_by: 'u1',
      amended_from: null,
      posting_datetime: '2026-08-01T00:00:00.000Z',
      remarks: null,
      pay_period_start: '2026-08-01',
      pay_period_end: '2026-08-31',
      lines: '[]',
      total_net_pay: 0,
    })
    expect(result.success).toBe(true)
  })
})

describe('payrollRunDraftSchema', () => {
  it('rejects a draft with no lines', () => {
    const result = payrollRunDraftSchema.safeParse({
      pay_period_start: '2026-08-01',
      pay_period_end: '2026-08-31',
      lines: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('incentiveRuleRowSchema', () => {
  it('accepts a well-formed row', () => {
    const result = incentiveRuleRowSchema.safeParse({
      $id: 'r1',
      $createdAt: '2026-08-01T00:00:00.000Z',
      $updatedAt: '2026-08-01T00:00:00.000Z',
      name: 'مكافأة مبيعات',
      kind: 'sales_commission',
      predicate: '{"ratePct":5}',
      amount_or_pct: 5,
      is_active: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown kind', () => {
    const result = incentiveRuleRowSchema.safeParse({
      $id: 'r1',
      $createdAt: '2026-08-01T00:00:00.000Z',
      $updatedAt: '2026-08-01T00:00:00.000Z',
      name: 'x',
      kind: 'bogus',
      amount_or_pct: 5,
      is_active: true,
    })
    expect(result.success).toBe(false)
  })
})

describe('incentiveRuleInputSchema', () => {
  it('rejects a negative amount_or_pct', () => {
    const result = incentiveRuleInputSchema.safeParse({
      name: 'x',
      kind: 'attendance_bonus',
      amount_or_pct: -5,
      is_active: true,
    })
    expect(result.success).toBe(false)
  })
})
