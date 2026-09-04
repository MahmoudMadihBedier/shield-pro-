import { describe, expect, it } from 'vitest'

import {
  approvalRequestRowSchema,
  approvalRuleInputSchema,
  approvalRuleLogRowSchema,
  approvalRuleRowSchema,
  approvalRuleWireInputSchema,
  decodeApprovalPredicate,
  encodeApprovalPredicate,
} from '../schemas'

const ruleRow = {
  $id: 'rule-1',
  $createdAt: 't',
  $updatedAt: 't',
  movement_type: 'sales_invoices',
  predicate: '{"maxQtyMultipleOfRepAverage":3}',
  action: 'auto_approve',
  priority: 10,
  is_active: true,
}

describe('approvalRuleRowSchema', () => {
  it('accepts a well-formed row', () => {
    expect(approvalRuleRowSchema.safeParse(ruleRow).success).toBe(true)
  })

  it('defaults a missing priority to 100 and is_active to true', () => {
    const parsed = approvalRuleRowSchema.parse({ ...ruleRow, priority: null, is_active: null })
    expect(parsed.priority).toBe(100)
    expect(parsed.is_active).toBe(true)
  })

  it('rejects an unknown action', () => {
    expect(approvalRuleRowSchema.safeParse({ ...ruleRow, action: 'auto_reject' }).success).toBe(false)
  })
})

describe('approvalRuleInputSchema', () => {
  it('accepts a structured predicate and required fields', () => {
    const parsed = approvalRuleInputSchema.safeParse({
      movement_type: 'sales_invoices',
      predicate: { maxQtyMultipleOfRepAverage: 3 },
      action: 'auto_approve',
      priority: 10,
      is_active: true,
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects an empty movement_type', () => {
    const parsed = approvalRuleInputSchema.safeParse({
      movement_type: '',
      predicate: {},
      action: 'auto_approve',
      priority: 10,
      is_active: true,
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a negative priority', () => {
    const parsed = approvalRuleInputSchema.safeParse({
      movement_type: 'sales_invoices',
      predicate: {},
      action: 'auto_approve',
      priority: -1,
      is_active: true,
    })
    expect(parsed.success).toBe(false)
  })
})

describe('approvalRuleWireInputSchema', () => {
  it('requires predicate to already be a JSON string', () => {
    const parsed = approvalRuleWireInputSchema.safeParse({
      movement_type: 'sales_invoices',
      predicate: '{"maxQtyMultipleOfRepAverage":3}',
      action: 'auto_approve',
      priority: 10,
      is_active: true,
    })
    expect(parsed.success).toBe(true)
  })
})

describe('encodeApprovalPredicate / decodeApprovalPredicate', () => {
  it('round-trips a predicate through JSON', () => {
    const predicate = { maxQtyMultipleOfRepAverage: 3, requireManualIfNewCustomer: true }
    expect(decodeApprovalPredicate(encodeApprovalPredicate(predicate))).toEqual(predicate)
  })

  it('decodes an empty object for malformed JSON rather than throwing', () => {
    expect(decodeApprovalPredicate('not json')).toEqual({})
  })

  it('decodes an empty object for a JSON value that fails the predicate schema', () => {
    expect(decodeApprovalPredicate('{"maxRepeatCount":"five"}')).toEqual({})
  })
})

describe('approvalRequestRowSchema', () => {
  it('accepts a pending request row', () => {
    const parsed = approvalRequestRowSchema.safeParse({
      $id: 'req-1',
      $createdAt: 't',
      $updatedAt: 't',
      entity_type: 'sales_invoices',
      entity_ref: 'INV-2026-00042',
      branch_id: null,
      requested_by: 'user-1',
      state: 'pending',
      decided_by: null,
      decision_reason: null,
      created_at: '2026-09-01T00:00:00.000Z',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects an unknown state', () => {
    const parsed = approvalRequestRowSchema.safeParse({
      $id: 'req-1',
      $createdAt: 't',
      $updatedAt: 't',
      entity_type: 'sales_invoices',
      entity_ref: 'INV-2026-00042',
      branch_id: null,
      requested_by: 'user-1',
      state: 'archived',
      decided_by: null,
      decision_reason: null,
      created_at: '2026-09-01T00:00:00.000Z',
    })
    expect(parsed.success).toBe(false)
  })
})

describe('approvalRuleLogRowSchema', () => {
  it('accepts a well-formed log row', () => {
    const parsed = approvalRuleLogRowSchema.safeParse({
      $id: 'log-1',
      $createdAt: 't',
      $updatedAt: 't',
      movement_type: 'sales_invoices',
      entity_ref: 'INV-2026-00042',
      actor_id: 'user-1',
      rule_matched: 'rule-1',
      outcome: 'auto_approve',
      created_at: '2026-09-01T00:00:00.000Z',
    })
    expect(parsed.success).toBe(true)
  })
})
