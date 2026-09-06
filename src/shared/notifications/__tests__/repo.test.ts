import { AppwriteException } from '@/infrastructure/appwrite/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows, mockUpdateRow } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockUpdateRow: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('@/infrastructure/appwrite/testing')
  return { tablesDB: { listRows: mockListRows, updateRow: mockUpdateRow }, Query }
})

import { listNotifications, markAllRead, markRead } from '../repo'

function notifRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'notif-1',
    $createdAt: '2026-09-01T09:00:00.000Z',
    $updatedAt: '2026-09-01T09:00:00.000Z',
    recipient_user_id: 'user-1',
    kind: 'fraud_flag',
    title: 'بلاغ احتيال جديد',
    body: 'تفاصيل البلاغ',
    entity_ref: 'p1:w1',
    is_read: false,
    created_at: '2026-09-01T09:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
  mockUpdateRow.mockReset()
})

describe('listNotifications', () => {
  it('always filters by recipient_user_id and parses rows', async () => {
    mockListRows.mockResolvedValueOnce({
      rows: [notifRow(), notifRow({ $id: 'notif-2' })],
      total: 2,
    })

    const result = await listNotifications({ recipientUserId: 'user-1', page: 0, pageSize: 10 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows).toHaveLength(2)
    expect(result.value.total).toBe(2)

    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    const joined = queries.join(' ')
    expect(joined).toMatch(/recipient_user_id/)
    expect(joined).toMatch(/user-1/)
    expect(joined).toMatch(/limit.*10/)
  })

  it('adds an is_read=false filter when onlyUnread is set', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [], total: 0 })

    await listNotifications({ recipientUserId: 'user-1', onlyUnread: true })

    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    expect(queries.join(' ')).toMatch(/is_read/)
  })

  it('fails with a server AppError when a row does not match the schema', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [{ $id: 'bad' }], total: 1 })
    const result = await listNotifications({ recipientUserId: 'user-1' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('nope', 503, 'server_error'))
    const result = await listNotifications({ recipientUserId: 'user-1' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })
})

describe('markRead', () => {
  it('updates is_read and returns the parsed row', async () => {
    mockUpdateRow.mockResolvedValueOnce(notifRow({ is_read: true }))

    const result = await markRead('notif-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.is_read).toBe(true)
    expect(mockUpdateRow).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: 'notif-1', data: { is_read: true } }),
    )
  })

  it('maps a forbidden Appwrite failure to a typed AppError', async () => {
    mockUpdateRow.mockRejectedValueOnce(new AppwriteException('nope', 403, 'forbidden'))
    const result = await markRead('notif-1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('forbidden')
  })
})

describe('markAllRead', () => {
  it('fetches every unread row for the recipient and updates each one', async () => {
    mockListRows.mockResolvedValueOnce({
      total: 2,
      rows: [notifRow({ $id: 'a' }), notifRow({ $id: 'b' })],
    })
    mockUpdateRow.mockResolvedValue({})

    const result = await markAllRead('user-1')

    expect(result.ok).toBe(true)
    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    expect(queries.join(' ')).toMatch(/recipient_user_id/)
    expect(queries.join(' ')).toMatch(/is_read/)
    expect(mockUpdateRow).toHaveBeenCalledTimes(2)
    expect(mockUpdateRow).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: 'a', data: { is_read: true } }),
    )
    expect(mockUpdateRow).toHaveBeenCalledWith(
      expect.objectContaining({ rowId: 'b', data: { is_read: true } }),
    )
  })

  it('does nothing when there are no unread rows', async () => {
    mockListRows.mockResolvedValueOnce({ total: 0, rows: [] })

    const result = await markAllRead('user-1')

    expect(result.ok).toBe(true)
    expect(mockUpdateRow).not.toHaveBeenCalled()
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('nope', 500, 'server_error'))
    const result = await markAllRead('user-1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })
})
