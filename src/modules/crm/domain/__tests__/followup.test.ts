import { describe, expect, it } from 'vitest'

import {
  countOverdue,
  followupFormSchema,
  followupStatusLabel,
  isOverdue,
  sortFollowups,
} from '../followup'

const TODAY = new Date('2026-03-15T12:00:00Z')

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  status: 'open' as const,
  due_date: '2026-03-15',
  $updatedAt: '2026-03-01T00:00:00Z',
  ...over,
})

describe('isOverdue', () => {
  it('is overdue only when open and the due date has passed', () => {
    expect(isOverdue(row({ due_date: '2026-03-14' }), TODAY)).toBe(true)
    expect(isOverdue(row({ due_date: '2026-03-15' }), TODAY)).toBe(false)
    expect(isOverdue(row({ due_date: '2026-03-16' }), TODAY)).toBe(false)
  })

  it('is never overdue once done or cancelled', () => {
    expect(isOverdue(row({ status: 'done', due_date: '2020-01-01' }), TODAY)).toBe(false)
    expect(isOverdue(row({ status: 'cancelled', due_date: '2020-01-01' }), TODAY)).toBe(false)
  })
})

describe('sortFollowups', () => {
  it('orders overdue-open first, then open by due date, then closed by recency', () => {
    const rows = [
      row({ due_date: '2026-04-01' }), // open, not yet due
      row({ status: 'done', $updatedAt: '2026-03-10T00:00:00Z' }),
      row({ due_date: '2026-03-01' }), // open, overdue (earliest)
      row({ due_date: '2026-03-10' }), // open, overdue
      row({ status: 'cancelled', $updatedAt: '2026-03-12T00:00:00Z' }),
    ]
    const sorted = sortFollowups(rows, TODAY)
    expect(sorted.map((r) => [r.status, r.status === 'open' ? r.due_date : r.$updatedAt])).toEqual([
      ['open', '2026-03-01'],
      ['open', '2026-03-10'],
      ['open', '2026-04-01'],
      ['cancelled', '2026-03-12T00:00:00Z'],
      ['done', '2026-03-10T00:00:00Z'],
    ])
  })

  it('does not mutate the input', () => {
    const rows = [row({ due_date: '2026-04-01' }), row({ due_date: '2026-03-01' })]
    sortFollowups(rows, TODAY)
    expect(rows.map((r) => r.due_date)).toEqual(['2026-04-01', '2026-03-01'])
  })
})

describe('countOverdue', () => {
  it('counts only overdue open rows', () => {
    const rows = [
      row({ due_date: '2026-03-01' }),
      row({ due_date: '2026-03-14' }),
      row({ due_date: '2026-04-01' }),
      row({ status: 'done', due_date: '2020-01-01' }),
    ]
    expect(countOverdue(rows, TODAY)).toBe(2)
  })
})

describe('followupStatusLabel', () => {
  it('maps known statuses and passes through unknowns', () => {
    expect(followupStatusLabel('open')).toBe('مفتوحة')
    expect(followupStatusLabel('mystery')).toBe('mystery')
  })
})

describe('followupFormSchema', () => {
  it('requires title, due date, and assignee', () => {
    expect(
      followupFormSchema.safeParse({ title: 'x', due_date: '2026-03-01', assigned_to: 'u1' })
        .success,
    ).toBe(true)
    expect(
      followupFormSchema.safeParse({ title: '  ', due_date: '2026-03-01', assigned_to: 'u1' })
        .success,
    ).toBe(false)
    expect(
      followupFormSchema.safeParse({ title: 'x', due_date: '', assigned_to: 'u1' }).success,
    ).toBe(false)
    expect(
      followupFormSchema.safeParse({ title: 'x', due_date: '2026-03-01', assigned_to: '' }).success,
    ).toBe(false)
  })
})
