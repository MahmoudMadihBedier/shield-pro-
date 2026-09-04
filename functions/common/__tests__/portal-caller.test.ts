import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { FnError } from '../handler'
import { requireCustomerCaller } from '../portal-caller'

function fakeDb(listRowsResult: unknown): TablesDB {
  return { listRows: vi.fn().mockResolvedValue(listRowsResult) } as unknown as TablesDB
}

describe('requireCustomerCaller', () => {
  it('resolves the customer whose portal_user_id matches the caller', async () => {
    const db = fakeDb({
      total: 1,
      rows: [
        {
          $id: 'cust-1',
          code: 'CUST001',
          name: 'Acme Foods',
          branch_id: 'cairo',
          portal_user_id: 'auth-1',
        },
      ],
    })

    const ctx = await requireCustomerCaller(db, 'auth-1')

    expect(ctx).toEqual({ customerId: 'cust-1', code: 'CUST001', name: 'Acme Foods', branchId: 'cairo' })
    expect(db.listRows).toHaveBeenCalledWith(
      expect.objectContaining({ databaseId: 'shield_pro', tableId: 'customers' }),
    )
  })

  it('normalizes an empty branch_id to null', async () => {
    const db = fakeDb({
      rows: [{ $id: 'cust-2', code: 'CUST002', name: 'No Branch Co', branch_id: '' }],
    })
    const ctx = await requireCustomerCaller(db, 'auth-2')
    expect(ctx.branchId).toBeNull()
  })

  it('rejects a caller with no linked customer row', async () => {
    const db = fakeDb({ total: 0, rows: [] })
    await expect(requireCustomerCaller(db, 'ghost')).rejects.toBeInstanceOf(FnError)
    await expect(requireCustomerCaller(db, 'ghost')).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects (server error) when the linked row is missing required fields', async () => {
    const db = fakeDb({ rows: [{ $id: 'cust-3' }] })
    await expect(requireCustomerCaller(db, 'auth-3')).rejects.toMatchObject({ code: 'server' })
  })
})
