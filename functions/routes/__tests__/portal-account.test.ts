import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import {
  createPortalAccount,
  resetPortalPin,
  revokePortalAccess,
  type UsersApi,
} from '../portal-account'

/** A `users` profile lookup result for `requireStaffCaller`. */
function profile(roles = 'system_admin', branchId: string | null = null) {
  return { total: 1, rows: [{ auth_user_id: 'auth', roles, branch_id: branchId ?? '' }] }
}

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  return { listRows: vi.fn().mockResolvedValue(profile()), ...over } as unknown as TablesDB
}

function fakeUsersApi(over: Partial<UsersApi> = {}): UsersApi {
  return {
    create: vi.fn().mockResolvedValue({ $id: 'portal-user-1' }),
    updatePassword: vi.fn().mockResolvedValue({}),
    updateStatus: vi.fn().mockResolvedValue({}),
    deleteSessions: vi.fn().mockResolvedValue({}),
    ...over,
  }
}

function customerRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'cust-1',
    code: 'CUST001',
    name: 'Acme Foods',
    portal_user_id: null,
    ...overrides,
  }
}

describe('createPortalAccount', () => {
  it('rejects a staff caller whose role may not manage portal accounts', async () => {
    const listRows = vi.fn().mockResolvedValue(profile('sales_rep'))
    await expect(
      createPortalAccount(
        fakeDb({ listRows }),
        fakeUsersApi(),
        { customerId: 'cust-1' },
        'user-1',
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects an anonymous caller', async () => {
    await expect(
      createPortalAccount(fakeDb({}), fakeUsersApi(), { customerId: 'cust-1' }, null),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('maps a missing customer to not_found', async () => {
    const getRow = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { code: 404 }))
    await expect(
      createPortalAccount(fakeDb({ getRow }), fakeUsersApi(), { customerId: 'cust-x' }, 'user-1'),
    ).rejects.toMatchObject({ code: 'not_found' })
  })

  it('rejects a customer that already has a portal account', async () => {
    const getRow = vi.fn().mockResolvedValue(customerRow({ portal_user_id: 'existing-user' }))
    const usersApi = fakeUsersApi()
    await expect(
      createPortalAccount(fakeDb({ getRow }), usersApi, { customerId: 'cust-1' }, 'user-1'),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(usersApi.create).not.toHaveBeenCalled()
  })

  it('creates the Auth account, links portal_user_id, audits, and returns an 8-digit PIN', async () => {
    const getRow = vi.fn().mockResolvedValue(customerRow())
    const updateRow = vi.fn().mockResolvedValue({})
    const createRow = vi.fn().mockResolvedValue({})
    const usersApi = fakeUsersApi()

    const out = await createPortalAccount(
      fakeDb({ getRow, updateRow, createRow }),
      usersApi,
      { customerId: 'cust-1' },
      'admin-1',
    )

    expect(out.portalUserId).toBe('portal-user-1')
    expect(out.pin).toMatch(/^\d{8}$/)

    expect(usersApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'cust001@portal.shieldpro.local',
        password: out.pin,
        name: 'Acme Foods',
      }),
    )
    expect(updateRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'customers',
        rowId: 'cust-1',
        data: { portal_user_id: 'portal-user-1' },
      }),
    )
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'audit_log',
        data: expect.objectContaining({ action: 'create_portal_account', entity_ref: 'CUST001' }),
      }),
    )
    // The PIN is never persisted — only the derived login email + Auth user id are.
    const auditCall = createRow.mock.calls[0]?.[0] as { data: { after: string } }
    expect(auditCall.data.after).not.toContain(out.pin)
  })
})

describe('resetPortalPin', () => {
  it('rejects a non-admin-role staff caller', async () => {
    const listRows = vi.fn().mockResolvedValue(profile('raw_store_keeper'))
    await expect(
      resetPortalPin(fakeDb({ listRows }), fakeUsersApi(), { customerId: 'cust-1' }, 'user-1'),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects a customer with no portal account', async () => {
    const getRow = vi.fn().mockResolvedValue(customerRow({ portal_user_id: null }))
    const usersApi = fakeUsersApi()
    await expect(
      resetPortalPin(fakeDb({ getRow }), usersApi, { customerId: 'cust-1' }, 'admin-1'),
    ).rejects.toMatchObject({ code: 'validation' })
    expect(usersApi.updatePassword).not.toHaveBeenCalled()
  })

  it('resets the password and returns a fresh 8-digit PIN', async () => {
    const getRow = vi.fn().mockResolvedValue(customerRow({ portal_user_id: 'portal-user-1' }))
    const createRow = vi.fn().mockResolvedValue({})
    const usersApi = fakeUsersApi()

    const out = await resetPortalPin(
      fakeDb({ getRow, createRow }),
      usersApi,
      { customerId: 'cust-1' },
      'admin-1',
    )

    expect(out.pin).toMatch(/^\d{8}$/)
    expect(usersApi.updatePassword).toHaveBeenCalledWith({
      userId: 'portal-user-1',
      password: out.pin,
    })
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'reset_portal_pin' }),
      }),
    )
  })
})

describe('revokePortalAccess', () => {
  it('rejects a non-admin-role staff caller', async () => {
    const listRows = vi.fn().mockResolvedValue(profile('sales_rep'))
    await expect(
      revokePortalAccess(fakeDb({ listRows }), fakeUsersApi(), { customerId: 'cust-1' }, 'user-1'),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects a customer with no portal account', async () => {
    const getRow = vi.fn().mockResolvedValue(customerRow({ portal_user_id: null }))
    await expect(
      revokePortalAccess(fakeDb({ getRow }), fakeUsersApi(), { customerId: 'cust-1' }, 'admin-1'),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('blocks logins and kills live sessions', async () => {
    const getRow = vi.fn().mockResolvedValue(customerRow({ portal_user_id: 'portal-user-1' }))
    const createRow = vi.fn().mockResolvedValue({})
    const usersApi = fakeUsersApi()

    const out = await revokePortalAccess(
      fakeDb({ getRow, createRow }),
      usersApi,
      { customerId: 'cust-1' },
      'admin-1',
    )

    expect(out).toEqual({ revoked: true })
    expect(usersApi.updateStatus).toHaveBeenCalledWith({ userId: 'portal-user-1', status: false })
    expect(usersApi.deleteSessions).toHaveBeenCalledWith({ userId: 'portal-user-1' })
  })
})
