import { describe, expect, it } from 'vitest'

import {
  isOpenStage,
  leadFormSchema,
  leadSourceLabel,
  leadStageLabel,
  openPipelineValue,
  sortLeads,
} from '../lead'

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  stage: 'new' as const,
  $createdAt: '2026-03-01T00:00:00Z',
  estimated_value: 0,
  ...over,
})

describe('isOpenStage', () => {
  it('treats won/lost as closed, everything else as open', () => {
    expect(isOpenStage('new')).toBe(true)
    expect(isOpenStage('qualified')).toBe(true)
    expect(isOpenStage('won')).toBe(false)
    expect(isOpenStage('lost')).toBe(false)
  })
})

describe('sortLeads', () => {
  it('orders by pipeline stage, then newest-created first within a stage', () => {
    const rows = [
      row({ stage: 'won', $createdAt: '2026-03-01T00:00:00Z' }),
      row({ stage: 'new', $createdAt: '2026-03-01T00:00:00Z' }),
      row({ stage: 'new', $createdAt: '2026-03-05T00:00:00Z' }),
      row({ stage: 'qualified', $createdAt: '2026-03-01T00:00:00Z' }),
    ]
    const sorted = sortLeads(rows)
    expect(sorted.map((r) => [r.stage, r.$createdAt])).toEqual([
      ['new', '2026-03-05T00:00:00Z'],
      ['new', '2026-03-01T00:00:00Z'],
      ['qualified', '2026-03-01T00:00:00Z'],
      ['won', '2026-03-01T00:00:00Z'],
    ])
  })

  it('does not mutate the input', () => {
    const rows = [row({ stage: 'won' }), row({ stage: 'new' })]
    sortLeads(rows)
    expect(rows.map((r) => r.stage)).toEqual(['won', 'new'])
  })
})

describe('openPipelineValue', () => {
  it('sums estimated_value for open-stage leads only, ignoring negatives/nulls', () => {
    const rows = [
      row({ stage: 'new', estimated_value: 1000 }),
      row({ stage: 'qualified', estimated_value: 500 }),
      row({ stage: 'won', estimated_value: 9999 }),
      row({ stage: 'contacted', estimated_value: null }),
      row({ stage: 'contacted', estimated_value: -50 }),
    ]
    expect(openPipelineValue(rows)).toBe(1500)
  })
})

describe('labels', () => {
  it('maps known values and passes through unknowns', () => {
    expect(leadStageLabel('qualified')).toBe('مؤهّل')
    expect(leadStageLabel('mystery')).toBe('mystery')
    expect(leadSourceLabel('referral')).toBe('إحالة')
    expect(leadSourceLabel(null)).toBeNull()
    expect(leadSourceLabel('')).toBeNull()
  })
})

describe('leadFormSchema', () => {
  it('accepts a minimal valid lead', () => {
    expect(
      leadFormSchema.safeParse({ name: 'Acme', assigned_to: 'u1', source: '', email: '' }).success,
    ).toBe(true)
  })

  it('rejects an empty name, a bad email, and a missing assignee', () => {
    expect(leadFormSchema.safeParse({ name: '  ', assigned_to: 'u1' }).success).toBe(false)
    expect(leadFormSchema.safeParse({ name: 'x', assigned_to: 'u1', email: 'nope' }).success).toBe(
      false,
    )
    expect(leadFormSchema.safeParse({ name: 'x', assigned_to: '' }).success).toBe(false)
  })
})
