import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { createNotification, listSystemAdminUserIds, notifySystemAdmins } from '../notifications'

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>> = {}): TablesDB {
  return {
    listRows: vi.fn(),
    createRow: vi.fn().mockResolvedValue({}),
    ...over,
  } as unknown as TablesDB
}

describe('createNotification', () => {
  it('writes a notifications row with is_read false and an ISO created_at', async () => {
    const createRow = vi.fn().mockResolvedValue({})
    const db = fakeDb({ createRow })

    await createNotification(db, {
      recipientUserId: 'user-1',
      kind: 'fraud_flag',
      title: 'بلاغ احتيال جديد',
      body: 'تفاصيل البلاغ',
      entityRef: 'p1:w1',
    })

    expect(createRow).toHaveBeenCalledTimes(1)
    const call = createRow.mock.calls[0]?.[0]
    expect(call).toMatchObject({
      databaseId: 'shield_pro',
      tableId: 'notifications',
      data: {
        recipient_user_id: 'user-1',
        kind: 'fraud_flag',
        title: 'بلاغ احتيال جديد',
        body: 'تفاصيل البلاغ',
        entity_ref: 'p1:w1',
        is_read: false,
      },
    })
    expect(typeof call.data.created_at).toBe('string')
    expect(() => new Date(call.data.created_at).toISOString()).not.toThrow()
    // Only the recipient can flip `is_read` from the browser SDK.
    expect(call.permissions).toEqual(['update("user:user-1")'])
  })

  it('defaults body and entity_ref to an empty string when omitted', async () => {
    const createRow = vi.fn().mockResolvedValue({})
    const db = fakeDb({ createRow })

    await createNotification(db, {
      recipientUserId: 'user-1',
      kind: 'approval_pending',
      title: 't',
    })

    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ body: '', entity_ref: '' }) }),
    )
  })

  it('truncates every string column to its schema cap', async () => {
    const createRow = vi.fn().mockResolvedValue({})
    const db = fakeDb({ createRow })

    await createNotification(db, {
      recipientUserId: 'u'.repeat(50),
      kind: 'k'.repeat(60),
      title: 't'.repeat(250),
      body: 'b'.repeat(2100),
      entityRef: 'e'.repeat(50),
    })

    const data = createRow.mock.calls[0]?.[0]?.data as Record<string, string>
    expect(data.recipient_user_id).toHaveLength(36)
    expect(data.kind).toHaveLength(48)
    expect(data.title).toHaveLength(200)
    expect(data.body).toHaveLength(2000)
    expect(data.entity_ref).toHaveLength(32)
  })
})

describe('listSystemAdminUserIds', () => {
  it('returns the auth_user_id of every row whose roles include system_admin', async () => {
    const listRows = vi.fn().mockResolvedValue({
      total: 3,
      rows: [
        { auth_user_id: 'admin-1', roles: 'system_admin' },
        { auth_user_id: 'accountant-1', roles: 'branch_accountant' },
        { auth_user_id: 'admin-2', roles: 'chief_accountant, system_admin' },
      ],
    })
    const db = fakeDb({ listRows })

    const ids = await listSystemAdminUserIds(db)

    expect(ids).toEqual(['admin-1', 'admin-2'])
    expect(listRows).toHaveBeenCalledWith(
      expect.objectContaining({ databaseId: 'shield_pro', tableId: 'users' }),
    )
  })

  it('reuses the same roles-string parsing as caller.ts (whitespace/commas, unknown slugs ignored)', async () => {
    const listRows = vi.fn().mockResolvedValue({
      total: 1,
      rows: [{ auth_user_id: 'admin-1', roles: '  ,, not_a_role   system_admin , ' }],
    })
    const db = fakeDb({ listRows })

    expect(await listSystemAdminUserIds(db)).toEqual(['admin-1'])
  })

  it('returns an empty list when nobody is a system_admin', async () => {
    const listRows = vi.fn().mockResolvedValue({ total: 0, rows: [] })
    const db = fakeDb({ listRows })

    expect(await listSystemAdminUserIds(db)).toEqual([])
  })
})

describe('notifySystemAdmins', () => {
  it('fans out to every user whose roles include system_admin and skips the rest', async () => {
    const listRows = vi.fn().mockResolvedValue({
      total: 3,
      rows: [
        { auth_user_id: 'admin-1', roles: 'system_admin' },
        { auth_user_id: 'accountant-1', roles: 'branch_accountant' },
        { auth_user_id: 'admin-2', roles: 'chief_accountant, system_admin' },
      ],
    })
    const createRow = vi.fn().mockResolvedValue({})
    const db = fakeDb({ listRows, createRow })

    await notifySystemAdmins(db, { kind: 'fraud_flag', title: 't', body: 'b', entityRef: 'ref-1' })

    expect(listRows).toHaveBeenCalledWith(
      expect.objectContaining({ databaseId: 'shield_pro', tableId: 'users' }),
    )
    expect(createRow).toHaveBeenCalledTimes(2)
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recipient_user_id: 'admin-1' }) }),
    )
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recipient_user_id: 'admin-2' }) }),
    )
  })

  it('creates nothing when no user has the system_admin role', async () => {
    const listRows = vi.fn().mockResolvedValue({
      total: 1,
      rows: [{ auth_user_id: 'user-1', roles: 'sales_rep' }],
    })
    const createRow = vi.fn()
    const db = fakeDb({ listRows, createRow })

    await notifySystemAdmins(db, { kind: 'approval_pending', title: 't' })

    expect(createRow).not.toHaveBeenCalled()
  })

  it('skips a matching row with no auth_user_id', async () => {
    const listRows = vi.fn().mockResolvedValue({
      total: 1,
      rows: [{ roles: 'system_admin' }],
    })
    const createRow = vi.fn()
    const db = fakeDb({ listRows, createRow })

    await notifySystemAdmins(db, { kind: 'approval_pending', title: 't' })

    expect(createRow).not.toHaveBeenCalled()
  })

  it('tolerates an empty users table', async () => {
    const listRows = vi.fn().mockResolvedValue({ total: 0, rows: [] })
    const createRow = vi.fn()
    const db = fakeDb({ listRows, createRow })

    await notifySystemAdmins(db, { kind: 'fraud_flag', title: 't' })

    expect(createRow).not.toHaveBeenCalled()
  })
})
