import { describe, expect, it } from 'vitest'

import {
  canTransitionLeadStage,
  describeStageEvent,
  isOpenStage,
  leadFormSchema,
  leadImportRowSchema,
  leadsToRows,
  leadSourceLabel,
  leadStageLabel,
  nextLeadStages,
  openPipelineValue,
  sortLeads,
  sortStageEvents,
  type LeadRow,
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
      leadFormSchema.safeParse({
        name: 'Acme',
        assigned_to: 'u1',
        source: '',
        email: '',
        estimated_value: 0,
      }).success,
    ).toBe(true)
  })

  it('rejects an empty name, a bad email, and a missing assignee', () => {
    expect(
      leadFormSchema.safeParse({ name: '  ', assigned_to: 'u1', estimated_value: 0 }).success,
    ).toBe(false)
    expect(
      leadFormSchema.safeParse({ name: 'x', assigned_to: 'u1', email: 'nope', estimated_value: 0 })
        .success,
    ).toBe(false)
    expect(
      leadFormSchema.safeParse({ name: 'x', assigned_to: '', estimated_value: 0 }).success,
    ).toBe(false)
  })

  it('rejects a NaN estimated_value (RHF valueAsNumber on an empty NumberField) — the field is a required 0-default, not optional', () => {
    expect(
      leadFormSchema.safeParse({ name: 'x', assigned_to: 'u1', estimated_value: Number.NaN })
        .success,
    ).toBe(false)
  })

  it('rejects a negative estimated_value', () => {
    expect(
      leadFormSchema.safeParse({ name: 'x', assigned_to: 'u1', estimated_value: -1 }).success,
    ).toBe(false)
  })

  it('accepts estimated_value: 0 — "no estimate"', () => {
    expect(
      leadFormSchema.safeParse({ name: 'x', assigned_to: 'u1', estimated_value: 0 }).success,
    ).toBe(true)
  })
})

describe('canTransitionLeadStage', () => {
  it('allows the pipeline forward path and "lost" from any open stage', () => {
    expect(canTransitionLeadStage('new', 'contacted')).toBe(true)
    expect(canTransitionLeadStage('contacted', 'qualified')).toBe(true)
    expect(canTransitionLeadStage('qualified', 'won')).toBe(true)
    expect(canTransitionLeadStage('new', 'lost')).toBe(true)
    expect(canTransitionLeadStage('qualified', 'lost')).toBe(true)
  })

  it('allows staying on the same stage (a no-op save)', () => {
    expect(canTransitionLeadStage('contacted', 'contacted')).toBe(true)
  })

  it('rejects skipping stages and reopening a closed lead', () => {
    expect(canTransitionLeadStage('new', 'won')).toBe(false)
    expect(canTransitionLeadStage('new', 'qualified')).toBe(false)
    expect(canTransitionLeadStage('won', 'qualified')).toBe(false)
    expect(canTransitionLeadStage('lost', 'new')).toBe(false)
  })
})

describe('nextLeadStages', () => {
  it('includes the current stage plus its allowed moves', () => {
    expect(nextLeadStages('new')).toEqual(['new', 'contacted', 'lost'])
    expect(nextLeadStages('won')).toEqual(['won'])
    expect(nextLeadStages('lost')).toEqual(['lost'])
  })
})

describe('describeStageEvent', () => {
  it('describes creation distinctly from a transition', () => {
    expect(describeStageEvent({ from_stage: null, to_stage: 'new' })).toBe('أُنشئ بمرحلة جديد')
    expect(describeStageEvent({ from_stage: 'new', to_stage: 'contacted' })).toBe(
      'من جديد إلى تم التواصل',
    )
  })
})

describe('sortStageEvents', () => {
  it('orders newest first', () => {
    const events = [
      { changed_at: '2026-03-01T00:00:00Z' },
      { changed_at: '2026-03-10T00:00:00Z' },
      { changed_at: '2026-03-05T00:00:00Z' },
    ]
    expect(sortStageEvents(events).map((e) => e.changed_at)).toEqual([
      '2026-03-10T00:00:00Z',
      '2026-03-05T00:00:00Z',
      '2026-03-01T00:00:00Z',
    ])
  })
})

describe('leadsToRows', () => {
  const fullLead = (over: Partial<LeadRow> = {}): LeadRow => ({
    $id: 'l1',
    $createdAt: '2026-03-01T00:00:00Z',
    $updatedAt: '2026-03-01T00:00:00Z',
    name: 'Acme',
    phone: '01000000000',
    email: 'acme@example.com',
    source: 'referral',
    stage: 'new',
    estimated_value: 500,
    notes: null,
    assigned_to: 'u1',
    created_by: 'u1',
    branch_id: 'b1',
    converted_customer_id: null,
    lost_reason: null,
    ...over,
  })

  it('resolves labels and the assignee name, and flags conversion', () => {
    const [row] = leadsToRows([fullLead({ converted_customer_id: 'c1' })], () => 'محمود')
    expect(row).toMatchObject({
      name: 'Acme',
      source: 'إحالة',
      stage: 'جديد',
      assigned_to: 'محمود',
      converted: 'نعم',
    })
  })

  it('falls back to empty strings for missing optional fields', () => {
    const [row] = leadsToRows([fullLead({ phone: null, email: null, source: null })], () => 'محمود')
    expect(row).toMatchObject({ phone: '', email: '', source: '' })
  })
})

describe('leadImportRowSchema', () => {
  it('accepts a minimal row (only name) — every other CSV column is optional', () => {
    expect(leadImportRowSchema.safeParse({ name: 'Acme' }).success).toBe(true)
  })

  it('coerces a CSV numeric string for estimated_value', () => {
    const r = leadImportRowSchema.safeParse({ name: 'Acme', estimated_value: '1500' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.estimated_value).toBe(1500)
  })

  it('rejects a blank name and a negative estimated_value', () => {
    expect(leadImportRowSchema.safeParse({ name: '' }).success).toBe(false)
    expect(leadImportRowSchema.safeParse({ name: 'Acme', estimated_value: '-1' }).success).toBe(
      false,
    )
  })

  it('rejects a source outside the known enum, accepts a known one or blank', () => {
    expect(leadImportRowSchema.safeParse({ name: 'Acme', source: 'not_a_source' }).success).toBe(
      false,
    )
    expect(leadImportRowSchema.safeParse({ name: 'Acme', source: 'referral' }).success).toBe(true)
    expect(leadImportRowSchema.safeParse({ name: 'Acme', source: '' }).success).toBe(true)
  })
})
