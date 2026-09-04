import { describe, expect, it } from 'vitest'

import { SOD_RULES, assertNoSelfApproval, checkSegregation } from '../segregation'

describe('checkSegregation — one test per rule', () => {
  it('catches requested_by === approved_by', () => {
    expect(checkSegregation({ requested_by: 'u1', approved_by: 'u1' }).violated).toContain(
      'requested-vs-approved',
    )
  })

  it('catches sent_by === confirmed_received_by', () => {
    expect(checkSegregation({ sent_by: 'u2', confirmed_received_by: 'u2' }).violated).toContain(
      'sent-vs-received',
    )
  })

  it('catches sold_by === cashup_confirmed_by', () => {
    expect(checkSegregation({ sold_by: 'u3', cashup_confirmed_by: 'u3' }).violated).toContain(
      'sold-vs-cashup',
    )
  })

  it('catches created_by === approved_by (purchase entered vs payment approved)', () => {
    expect(checkSegregation({ created_by: 'u4', approved_by: 'u4' }).violated).toContain(
      'entered-vs-approved',
    )
  })
})

describe('checkSegregation — non-violations', () => {
  it('is not a violation when one side is empty even if the other equals it', () => {
    expect(checkSegregation({ requested_by: 'u1', approved_by: '' }).violated).toEqual([])
    expect(checkSegregation({ requested_by: '   ', approved_by: '   ' }).violated).toEqual([])
    expect(checkSegregation({ sent_by: 'u1' }).violated).toEqual([])
  })

  it('passes a clean row where every actor pair differs', () => {
    expect(
      checkSegregation({
        created_by: 'entry-clerk',
        requested_by: 'requester',
        approved_by: 'approver',
        sent_by: 'shipper',
        confirmed_received_by: 'receiver',
        sold_by: 'rep',
        cashup_confirmed_by: 'cashier',
      }).violated,
    ).toEqual([])
  })

  it('ignores non-string actor columns', () => {
    expect(
      checkSegregation({ requested_by: 1 as unknown, approved_by: 1 as unknown }).violated,
    ).toEqual([])
  })
})

describe('assertNoSelfApproval', () => {
  it('does not throw on a clean row', () => {
    expect(() => assertNoSelfApproval({ requested_by: 'a', approved_by: 'b' })).not.toThrow()
  })

  it('throws a coded Error listing the violated rules', () => {
    let caught: unknown
    try {
      assertNoSelfApproval({ requested_by: 'u1', approved_by: 'u1' })
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as { code?: string }).code).toBe('sod')
    expect((caught as { violated?: string[] }).violated).toContain('requested-vs-approved')
    expect((caught as Error).message).toContain('may not approve it')
  })

  it('reports every violated rule at once', () => {
    try {
      assertNoSelfApproval({
        requested_by: 'same',
        approved_by: 'same',
        created_by: 'same',
        sold_by: 'x',
        cashup_confirmed_by: 'x',
      })
      expect.unreachable('should have thrown')
    } catch (e) {
      expect((e as { violated: string[] }).violated.sort()).toEqual(
        ['entered-vs-approved', 'requested-vs-approved', 'sold-vs-cashup'].sort(),
      )
    }
  })
})

describe('SOD_RULES', () => {
  it('exposes the four declarative pairs with unique ids', () => {
    expect(SOD_RULES).toHaveLength(4)
    expect(new Set(SOD_RULES.map((r) => r.id)).size).toBe(4)
    for (const r of SOD_RULES) {
      expect(r.a).not.toBe(r.b)
      expect(r.message.length).toBeGreaterThan(0)
    }
  })
})
