import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { evaluateApproval } from '../evaluate-approval'

const NOW = new Date('2026-09-01T12:00:00.000Z')
const CALLER = 'user-7'

/** A `users` profile lookup result for `requireStaffCaller` — always call #1. */
const STAFF_PROFILE = {
  total: 1,
  rows: [{ auth_user_id: CALLER, roles: 'branch_accountant', branch_id: '' }],
}

const NO_EXISTING_REQUEST = { total: 0, rows: [] }

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  return { listRows: vi.fn().mockResolvedValue(STAFF_PROFILE), ...over } as unknown as TablesDB
}

const baseInput = {
  movementType: 'sales_invoices',
  entityRef: 'INV-2026-00042',
  context: { qty: 10, repAverageQty: 10 },
}

function ruleRow(over: Record<string, unknown> = {}) {
  return {
    $id: 'rule-1',
    movement_type: 'sales_invoices',
    predicate: JSON.stringify({ maxQtyMultipleOfRepAverage: 3 }),
    action: 'auto_approve',
    priority: 100,
    is_active: true,
    ...over,
  }
}

describe('evaluateApproval', () => {
  it('rejects an anonymous caller', async () => {
    await expect(
      evaluateApproval(fakeDb({}), baseInput, null, NOW),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('rejects a caller with no staff profile', async () => {
    const listRows = vi.fn().mockResolvedValue({ total: 0, rows: [] })
    await expect(
      evaluateApproval(fakeDb({ listRows }), baseInput, CALLER, NOW),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('requires a movementType', async () => {
    await expect(
      evaluateApproval(fakeDb({}), { ...baseInput, movementType: '' }, CALLER, NOW),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('requires an entityRef', async () => {
    await expect(
      evaluateApproval(fakeDb({}), { ...baseInput, entityRef: '' }, CALLER, NOW),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('auto-approves within the rep-average multiple, logs the rule and creates an auto_approved request', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(STAFF_PROFILE) // requireStaffCaller
      .mockResolvedValueOnce(NO_EXISTING_REQUEST) // idempotency check
      .mockResolvedValueOnce({ total: 1, rows: [ruleRow()] }) // active rules
    const createRow = vi
      .fn()
      .mockResolvedValueOnce({ $id: 'log-1' }) // approval_rule_log
      .mockResolvedValueOnce({ $id: 'req-1' }) // approval_requests

    const out = await evaluateApproval(fakeDb({ listRows, createRow }), baseInput, CALLER, NOW)

    expect(out).toEqual({ action: 'auto_approve', ruleId: 'rule-1', approvalRequestId: 'req-1' })
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'approval_rule_log',
        data: expect.objectContaining({
          movement_type: 'sales_invoices',
          entity_ref: 'INV-2026-00042',
          actor_id: CALLER,
          rule_matched: 'rule-1',
          outcome: 'auto_approve',
        }),
      }),
    )
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'approval_requests',
        data: expect.objectContaining({
          entity_type: 'sales_invoices',
          entity_ref: 'INV-2026-00042',
          requested_by: CALLER,
          state: 'auto_approved',
        }),
      }),
    )
  })

  it('forces manual review when no active rule matches (fail-safe) and creates a pending request', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(STAFF_PROFILE) // requireStaffCaller
      .mockResolvedValueOnce(NO_EXISTING_REQUEST) // idempotency check
      .mockResolvedValueOnce({ total: 0, rows: [] }) // no active rules
    const createRow = vi
      .fn()
      .mockResolvedValueOnce({ $id: 'log-2' })
      .mockResolvedValueOnce({ $id: 'req-2' })

    const out = await evaluateApproval(
      fakeDb({ listRows, createRow }),
      { ...baseInput, context: {} },
      CALLER,
      NOW,
    )

    expect(out).toEqual({ action: 'force_manual', ruleId: null, approvalRequestId: 'req-2' })
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'approval_requests',
        data: expect.objectContaining({ state: 'pending' }),
      }),
    )
  })

  it('is idempotent — a second evaluation for the same entityRef replays the existing decision', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(STAFF_PROFILE) // requireStaffCaller
      .mockResolvedValueOnce({ total: 1, rows: [{ $id: 'req-1', state: 'auto_approved' }] }) // existing
    const createRow = vi.fn()

    const out = await evaluateApproval(fakeDb({ listRows, createRow }), baseInput, CALLER, NOW)

    expect(out).toEqual({ action: 'auto_approve', ruleId: null, approvalRequestId: 'req-1' })
    expect(createRow).not.toHaveBeenCalled()
  })

  it('replays a pending existing request as force_manual', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(STAFF_PROFILE)
      .mockResolvedValueOnce({ total: 1, rows: [{ $id: 'req-3', state: 'pending' }] })
    const createRow = vi.fn()

    const out = await evaluateApproval(fakeDb({ listRows, createRow }), baseInput, CALLER, NOW)

    expect(out).toEqual({ action: 'force_manual', ruleId: null, approvalRequestId: 'req-3' })
    expect(createRow).not.toHaveBeenCalled()
  })

  it('never auto-approves a new customer even under a matching auto_approve rule', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(STAFF_PROFILE)
      .mockResolvedValueOnce(NO_EXISTING_REQUEST)
      .mockResolvedValueOnce({
        total: 1,
        rows: [
          ruleRow({
            predicate: JSON.stringify({
              maxQtyMultipleOfRepAverage: 3,
              requireManualIfNewCustomer: true,
            }),
          }),
        ],
      })
    const createRow = vi
      .fn()
      .mockResolvedValueOnce({ $id: 'log-3' })
      .mockResolvedValueOnce({ $id: 'req-4' })

    const out = await evaluateApproval(
      fakeDb({ listRows, createRow }),
      { ...baseInput, context: { qty: 5, repAverageQty: 10, isNewCustomer: true } },
      CALLER,
      NOW,
    )

    expect(out).toEqual({ action: 'force_manual', ruleId: 'rule-1', approvalRequestId: 'req-4' })
  })
})
