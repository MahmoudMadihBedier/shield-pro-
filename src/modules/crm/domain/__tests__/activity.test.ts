import { describe, expect, it } from 'vitest'

import {
  activitiesToRows,
  activityFormSchema,
  activityKindLabel,
  activityOutcomeLabel,
  countByKind,
  sortActivities,
  type ActivityRow,
} from '../activity'

describe('sortActivities', () => {
  it('orders newest occurred_at first, then newest $createdAt', () => {
    const rows = [
      { $id: 'a', occurred_at: '2026-03-01T00:00:00Z', $createdAt: '2026-03-01T09:00:00Z' },
      { $id: 'b', occurred_at: '2026-03-05T00:00:00Z', $createdAt: '2026-03-05T09:00:00Z' },
      { $id: 'c', occurred_at: '2026-03-01T00:00:00Z', $createdAt: '2026-03-02T09:00:00Z' },
    ]
    expect(sortActivities(rows).map((r) => r.$id)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate the input', () => {
    const rows = [
      { $id: 'a', occurred_at: '2026-01-01T00:00:00Z', $createdAt: '2026-01-01T00:00:00Z' },
      { $id: 'b', occurred_at: '2026-02-01T00:00:00Z', $createdAt: '2026-02-01T00:00:00Z' },
    ]
    sortActivities(rows)
    expect(rows.map((r) => r.$id)).toEqual(['a', 'b'])
  })
})

describe('countByKind', () => {
  it('tallies by kind, most frequent first', () => {
    expect(
      countByKind([{ kind: 'call' }, { kind: 'visit' }, { kind: 'call' }, { kind: 'call' }]),
    ).toEqual([
      ['call', 3],
      ['visit', 1],
    ])
  })
})

describe('labels', () => {
  it('maps known kinds/outcomes and passes through unknowns', () => {
    expect(activityKindLabel('whatsapp')).toBe('واتساب')
    expect(activityKindLabel('mystery')).toBe('mystery')
    expect(activityOutcomeLabel('positive')).toBe('إيجابية')
    expect(activityOutcomeLabel(null)).toBeNull()
    expect(activityOutcomeLabel('')).toBeNull()
  })
})

describe('activityFormSchema', () => {
  it('accepts a minimal valid entry (blank outcome allowed)', () => {
    const r = activityFormSchema.safeParse({
      kind: 'call',
      subject: 'اتصلت للمتابعة',
      occurred_on: '2026-03-01',
      outcome: '',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an empty subject and an empty date', () => {
    expect(
      activityFormSchema.safeParse({ kind: 'call', subject: '  ', occurred_on: '2026-03-01' })
        .success,
    ).toBe(false)
    expect(
      activityFormSchema.safeParse({ kind: 'call', subject: 'x', occurred_on: '' }).success,
    ).toBe(false)
  })
})

describe('activitiesToRows', () => {
  const fullActivity = (over: Partial<ActivityRow> = {}): ActivityRow => ({
    $id: 'a1',
    $createdAt: '2026-03-01T09:00:00Z',
    $updatedAt: '2026-03-01T09:00:00Z',
    customer_id: 'c1',
    kind: 'call',
    subject: 'تأكيد الطلب',
    note: null,
    occurred_at: '2026-03-01T00:00:00Z',
    outcome: null,
    created_by: 'u1',
    branch_id: 'b1',
    ...over,
  })

  it('resolves kind/outcome labels and defaults missing note/outcome to empty strings', () => {
    const [row] = activitiesToRows([fullActivity({ kind: 'whatsapp', outcome: 'positive' })])
    expect(row).toEqual({
      date: '2026-03-01T00:00:00Z',
      kind: 'واتساب',
      subject: 'تأكيد الطلب',
      note: '',
      outcome: 'إيجابية',
    })
  })
})
