import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { reviewFraudFlag } from '../review-fraud-flag'

const CALLER = 'user-7'
/** A `users` profile lookup result for `requireStaffCaller` — always call #1. */
const STAFF_PROFILE = {
  total: 1,
  rows: [{ auth_user_id: CALLER, roles: 'chief_accountant', branch_id: '' }],
}

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  return { listRows: vi.fn().mockResolvedValue(STAFF_PROFILE), ...over } as unknown as TablesDB
}

const baseInput = { flagId: 'flag-1', status: 'reviewed' as const }

describe('reviewFraudFlag', () => {
  it('rejects an anonymous caller', async () => {
    await expect(reviewFraudFlag(fakeDb({}), baseInput, null)).rejects.toMatchObject({
      code: 'unauthorized',
    })
  })

  it('rejects a caller with no staff profile', async () => {
    const listRows = vi.fn().mockResolvedValue({ total: 0, rows: [] })
    await expect(reviewFraudFlag(fakeDb({ listRows }), baseInput, CALLER)).rejects.toMatchObject({
      code: 'forbidden',
    })
  })

  it('rejects an invalid status value', async () => {
    await expect(
      reviewFraudFlag(fakeDb({}), { flagId: 'flag-1', status: 'closed' as never }, CALLER),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('maps a missing flag to not_found', async () => {
    const getRow = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { code: 404 }))
    await expect(reviewFraudFlag(fakeDb({ getRow }), baseInput, CALLER)).rejects.toMatchObject({
      code: 'not_found',
    })
  })

  it('refuses to review a flag that is not open', async () => {
    const getRow = vi.fn().mockResolvedValue({ $id: 'flag-1', status: 'dismissed' })
    const updateRow = vi.fn()
    await expect(
      reviewFraudFlag(fakeDb({ getRow, updateRow }), baseInput, CALLER),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(updateRow).not.toHaveBeenCalled()
  })

  it('transitions an open flag to reviewed and writes an audit row', async () => {
    const getRow = vi.fn().mockResolvedValue({ $id: 'flag-1', status: 'open' })
    const updateRow = vi.fn().mockResolvedValue({})
    const createRow = vi.fn().mockResolvedValue({})

    const out = await reviewFraudFlag(fakeDb({ getRow, updateRow, createRow }), baseInput, CALLER)

    expect(out).toEqual({ id: 'flag-1', status: 'reviewed' })
    expect(updateRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'fraud_flags',
        rowId: 'flag-1',
        data: { status: 'reviewed' },
      }),
    )
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'audit_log',
        data: expect.objectContaining({
          actor_id: CALLER,
          action: 'review_fraud_flag',
          entity_type: 'fraud_flags',
          entity_ref: 'flag-1',
        }),
      }),
    )
  })

  it('transitions an open flag to dismissed', async () => {
    const getRow = vi.fn().mockResolvedValue({ $id: 'flag-1', status: 'open' })
    const updateRow = vi.fn().mockResolvedValue({})
    const createRow = vi.fn().mockResolvedValue({})

    const out = await reviewFraudFlag(
      fakeDb({ getRow, updateRow, createRow }),
      { flagId: 'flag-1', status: 'dismissed' },
      CALLER,
    )

    expect(out).toEqual({ id: 'flag-1', status: 'dismissed' })
    expect(updateRow).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'dismissed' } }),
    )
  })
})
