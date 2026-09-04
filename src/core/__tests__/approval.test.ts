import { describe, expect, it } from 'vitest'

import {
  approvalPredicateSchema,
  decideApproval,
  evaluateRule,
  type ApprovalContext,
  type ApprovalRuleLike,
} from '../approval'

function ctx(overrides: Partial<ApprovalContext> = {}): ApprovalContext {
  return {
    movementType: 'sales_invoices',
    entityRef: 'INV-2026-00001',
    actorId: 'user-1',
    ...overrides,
  }
}

function rule(overrides: Partial<ApprovalRuleLike> = {}): ApprovalRuleLike {
  return {
    id: 'rule-1',
    movementType: 'sales_invoices',
    predicate: {},
    action: 'auto_approve',
    priority: 100,
    isActive: true,
    ...overrides,
  }
}

describe('approvalPredicateSchema', () => {
  it('accepts an empty object — every field is optional', () => {
    expect(approvalPredicateSchema.safeParse({}).success).toBe(true)
  })

  it('accepts a fully populated predicate', () => {
    const parsed = approvalPredicateSchema.safeParse({
      maxQtyMultipleOfRepAverage: 3,
      maxRepeatCount: 5,
      repeatWindowHours: 24,
      requireManualIfNewCustomer: true,
      requireManualIfOverCreditLimit: true,
      requireManualIfPriceOverride: true,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a non-numeric threshold', () => {
    expect(approvalPredicateSchema.safeParse({ maxRepeatCount: 'five' }).success).toBe(false)
  })
})

describe('evaluateRule', () => {
  it('matches and auto-approves when qty is within the rep-average multiple', () => {
    const result = evaluateRule(
      { maxQtyMultipleOfRepAverage: 3 },
      ctx({ qty: 30, repAverageQty: 10 }),
    )
    expect(result).toEqual({ matched: true, forcesManual: false })
  })

  it('does not match once qty exceeds the rep-average multiple', () => {
    const result = evaluateRule(
      { maxQtyMultipleOfRepAverage: 3 },
      ctx({ qty: 31, repAverageQty: 10 }),
    )
    expect(result).toEqual({ matched: false, forcesManual: false })
  })

  it('forces manual once the same actor repeats past maxRepeatCount', () => {
    const result = evaluateRule(
      { maxRepeatCount: 3 },
      ctx({ recentSameActorItemCount: 4 }),
    )
    expect(result).toEqual({ matched: true, forcesManual: true })
  })

  it('does not trip the repeat guard at or under the count', () => {
    const result = evaluateRule({ maxRepeatCount: 3 }, ctx({ recentSameActorItemCount: 3 }))
    expect(result).toEqual({ matched: false, forcesManual: false })
  })

  it('forces manual for a new customer', () => {
    const result = evaluateRule(
      { requireManualIfNewCustomer: true },
      ctx({ isNewCustomer: true }),
    )
    expect(result).toEqual({ matched: true, forcesManual: true })
  })

  it('forces manual when over the credit limit', () => {
    const result = evaluateRule(
      { requireManualIfOverCreditLimit: true },
      ctx({ overCreditLimit: true }),
    )
    expect(result).toEqual({ matched: true, forcesManual: true })
  })

  it('forces manual on a price override', () => {
    const result = evaluateRule(
      { requireManualIfPriceOverride: true },
      ctx({ isPriceOverride: true }),
    )
    expect(result).toEqual({ matched: true, forcesManual: true })
  })

  it('does not match an empty predicate', () => {
    expect(evaluateRule({}, ctx())).toEqual({ matched: false, forcesManual: false })
  })
})

describe('decideApproval', () => {
  it('auto-approves when the qty is within the rep daily-average multiple', () => {
    const rules = [rule({ id: 'r-avg', predicate: { maxQtyMultipleOfRepAverage: 3 } })]
    const decision = decideApproval(rules, ctx({ qty: 20, repAverageQty: 10 }))
    expect(decision).toEqual({ action: 'auto_approve', ruleId: 'r-avg' })
  })

  it('forces manual once qty exceeds the rep-average multiple (fail-safe, no other rule)', () => {
    const rules = [rule({ id: 'r-avg', predicate: { maxQtyMultipleOfRepAverage: 3 } })]
    const decision = decideApproval(rules, ctx({ qty: 40, repAverageQty: 10 }))
    expect(decision).toEqual({ action: 'force_manual', ruleId: null })
  })

  it('forces manual when the same actor/item repeats past the trip count', () => {
    const rules = [
      rule({
        id: 'r-repeat',
        action: 'auto_approve',
        predicate: { maxRepeatCount: 3, repeatWindowHours: 24 },
      }),
    ]
    const decision = decideApproval(rules, ctx({ recentSameActorItemCount: 5 }))
    expect(decision).toEqual({ action: 'force_manual', ruleId: 'r-repeat' })
  })

  it('forces manual for a new customer even under an auto_approve rule', () => {
    const rules = [
      rule({ id: 'r-new-cust', action: 'auto_approve', predicate: { requireManualIfNewCustomer: true } }),
    ]
    const decision = decideApproval(rules, ctx({ isNewCustomer: true }))
    expect(decision).toEqual({ action: 'force_manual', ruleId: 'r-new-cust' })
  })

  it('forces manual over the credit limit even under an auto_approve rule', () => {
    const rules = [
      rule({
        id: 'r-credit',
        action: 'auto_approve',
        predicate: { requireManualIfOverCreditLimit: true },
      }),
    ]
    const decision = decideApproval(rules, ctx({ overCreditLimit: true }))
    expect(decision).toEqual({ action: 'force_manual', ruleId: 'r-credit' })
  })

  it('forces manual on a price override even under an auto_approve rule', () => {
    const rules = [
      rule({
        id: 'r-price',
        action: 'auto_approve',
        predicate: { requireManualIfPriceOverride: true },
      }),
    ]
    const decision = decideApproval(rules, ctx({ isPriceOverride: true }))
    expect(decision).toEqual({ action: 'force_manual', ruleId: 'r-price' })
  })

  it('evaluates lower-priority-number rules first when several match', () => {
    const rules = [
      rule({ id: 'r-low-priority-number', priority: 5, action: 'force_manual', predicate: {} }),
      rule({ id: 'r-high-priority-number', priority: 50, action: 'auto_approve', predicate: {} }),
    ]
    // Both rules use an empty predicate so neither "matches" by content — swap
    // in a trivially-true condition on each so priority ordering is what's
    // actually under test.
    const withConditions = [
      { ...rules[0]!, predicate: { requireManualIfNewCustomer: true } },
      { ...rules[1]!, predicate: { requireManualIfNewCustomer: true } },
    ]
    const decision = decideApproval(withConditions, ctx({ isNewCustomer: true }))
    expect(decision).toEqual({ action: 'force_manual', ruleId: 'r-low-priority-number' })
  })

  it('falls back to force_manual with a null ruleId when nothing matches', () => {
    const rules = [rule({ id: 'r-no-match', predicate: { requireManualIfNewCustomer: true } })]
    const decision = decideApproval(rules, ctx({ isNewCustomer: false }))
    expect(decision).toEqual({ action: 'force_manual', ruleId: null })
  })

  it('falls back to force_manual with a null ruleId when there are no rules at all', () => {
    expect(decideApproval([], ctx())).toEqual({ action: 'force_manual', ruleId: null })
  })

  it('ignores an inactive rule even if its predicate would match', () => {
    const rules = [
      rule({
        id: 'r-inactive',
        isActive: false,
        predicate: { requireManualIfNewCustomer: true },
      }),
    ]
    const decision = decideApproval(rules, ctx({ isNewCustomer: true }))
    expect(decision).toEqual({ action: 'force_manual', ruleId: null })
  })

  it('ignores rules for a different movement type', () => {
    const rules = [
      rule({
        id: 'r-other-type',
        movementType: 'warehouse_transfers',
        predicate: { maxQtyMultipleOfRepAverage: 100 },
      }),
    ]
    const decision = decideApproval(rules, ctx({ qty: 1, repAverageQty: 1 }))
    expect(decision).toEqual({ action: 'force_manual', ruleId: null })
  })
})
