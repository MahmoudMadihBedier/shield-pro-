import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { decideApprovalRequest } from '../decide-approval'

const CALLER = 'user-9'

/** A `users` profile lookup result for `requireStaffCaller` — always call #1. */
const STAFF_PROFILE = {
  total: 1,
  rows: [{ auth_user_id: CALLER, roles: 'chief_accountant', branch_id: '' }],
}

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  return { listRows: vi.fn().mockResolvedValue(STAFF_PROFILE), ...over } as unknown as TablesDB
}

function pendingRow(over: Record<string, unknown> = {}) {
  return {
    $id: 'req-1',
    entity_type: 'sales_invoices',
    entity_ref: 'INV-2026-00042',
    branch_id: null,
    requested_by: 'user-1',
    state: 'pending',
    ...over,
  }
}

describe('decideApprovalRequest', () => {
  it('rejects an anonymous caller', async () => {
    await expect(
      decideApprovalRequest(fakeDb({}), { approvalRequestId: 'req-1', decision: 'approved' }, null),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('rejects a caller with no staff profile', async () => {
    const listRows = vi.fn().mockResolvedValue({ total: 0, rows: [] })
    await expect(
      decideApprovalRequest(
        fakeDb({ listRows }),
        { approvalRequestId: 'req-1', decision: 'approved' },
        CALLER,
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('requires an approvalRequestId', async () => {
    await expect(
      decideApprovalRequest(fakeDb({}), { approvalRequestId: '', decision: 'approved' }, CALLER),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('requires decision to be approved or rejected', async () => {
    await expect(
      decideApprovalRequest(
        fakeDb({}),
        // @ts-expect-error — deliberately invalid at the wire boundary
        { approvalRequestId: 'req-1', decision: 'maybe' },
        CALLER,
      ),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('maps a missing request to not_found', async () => {
    const getRow = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { code: 404 }))
    await expect(
      decideApprovalRequest(
        fakeDb({ getRow }),
        { approvalRequestId: 'req-1', decision: 'approved' },
        CALLER,
      ),
    ).rejects.toMatchObject({ code: 'not_found' })
  })

  it('refuses to decide a request that is not pending', async () => {
    const getRow = vi.fn().mockResolvedValue(pendingRow({ state: 'approved' }))
    const updateRow = vi.fn()
    await expect(
      decideApprovalRequest(
        fakeDb({ getRow, updateRow }),
        { approvalRequestId: 'req-1', decision: 'rejected' },
        CALLER,
      ),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(updateRow).not.toHaveBeenCalled()
  })

  it('refuses a self-decision (requested_by === caller)', async () => {
    const getRow = vi.fn().mockResolvedValue(pendingRow({ requested_by: CALLER }))
    const updateRow = vi.fn()
    await expect(
      decideApprovalRequest(
        fakeDb({ getRow, updateRow }),
        { approvalRequestId: 'req-1', decision: 'approved' },
        CALLER,
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
    expect(updateRow).not.toHaveBeenCalled()
  })

  it('approves a pending request, stamps the decider, and writes an audit row', async () => {
    const getRow = vi.fn().mockResolvedValue(pendingRow())
    const updateRow = vi.fn().mockResolvedValue({})
    const createRow = vi.fn().mockResolvedValue({})

    const out = await decideApprovalRequest(
      fakeDb({ getRow, updateRow, createRow }),
      { approvalRequestId: 'req-1', decision: 'approved', reason: 'looks fine' },
      CALLER,
    )

    expect(out).toEqual({
      $id: 'req-1',
      entityType: 'sales_invoices',
      entityRef: 'INV-2026-00042',
      branchId: null,
      requestedBy: 'user-1',
      state: 'approved',
      decidedBy: CALLER,
      decisionReason: 'looks fine',
    })
    expect(updateRow).toHaveBeenCalledWith({
      databaseId: 'shield_pro',
      tableId: 'approval_requests',
      rowId: 'req-1',
      data: { state: 'approved', decided_by: CALLER, decision_reason: 'looks fine' },
    })
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'audit_log',
        data: expect.objectContaining({
          actor_id: CALLER,
          action: 'decide_approval',
          entity_type: 'sales_invoices',
          entity_ref: 'INV-2026-00042',
        }),
      }),
    )
  })

  it('rejects a pending request with no reason given', async () => {
    const getRow = vi.fn().mockResolvedValue(pendingRow())
    const updateRow = vi.fn().mockResolvedValue({})
    const createRow = vi.fn().mockResolvedValue({})

    const out = await decideApprovalRequest(
      fakeDb({ getRow, updateRow, createRow }),
      { approvalRequestId: 'req-1', decision: 'rejected' },
      CALLER,
    )

    expect(out.state).toBe('rejected')
    expect(out.decisionReason).toBeNull()
    expect(updateRow).toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: 'rejected', decided_by: CALLER, decision_reason: null } }),
    )
  })
})
