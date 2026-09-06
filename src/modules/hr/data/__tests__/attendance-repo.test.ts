import { AppwriteException } from '@/infrastructure/appwrite/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows, mockCreateRow, mockUpdateRow } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockCreateRow: vi.fn(),
  mockUpdateRow: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { ID, Query } = await import('@/infrastructure/appwrite/testing')
  return {
    tablesDB: { listRows: mockListRows, createRow: mockCreateRow, updateRow: mockUpdateRow },
    ID,
    Query,
  }
})

import { listAttendance, upsertAttendance } from '../attendance-repo'

function attendanceRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'att-1',
    $createdAt: '2026-08-01T00:00:00.000Z',
    $updatedAt: '2026-08-01T00:00:00.000Z',
    user_id: 'u1',
    date: '2026-08-01',
    check_in: null,
    check_out: null,
    status: 'present',
    notes: null,
    branch_id: 'br-1',
    created_by: 'u2',
    created_at: '2026-08-01T08:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
  mockCreateRow.mockReset()
  mockUpdateRow.mockReset()
})

describe('upsertAttendance', () => {
  it('creates a new row when none exists for (user_id, date)', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [], total: 0 })
    mockCreateRow.mockResolvedValueOnce(attendanceRow())

    const result = await upsertAttendance({
      userId: 'u1',
      date: '2026-08-01',
      status: 'present',
      createdBy: 'u2',
    })

    expect(result.ok).toBe(true)
    expect(mockCreateRow).toHaveBeenCalledTimes(1)
    expect(mockUpdateRow).not.toHaveBeenCalled()

    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    expect(queries.join(' ')).toMatch(/user_id/)
    expect(queries.join(' ')).toMatch(/date/)
  })

  it('updates the existing row when one already exists for (user_id, date)', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [attendanceRow({ $id: 'att-existing' })], total: 1 })
    mockUpdateRow.mockResolvedValueOnce(attendanceRow({ $id: 'att-existing', status: 'absent' }))

    const result = await upsertAttendance({
      userId: 'u1',
      date: '2026-08-01',
      status: 'absent',
      createdBy: 'u2',
    })

    expect(result.ok).toBe(true)
    expect(mockUpdateRow).toHaveBeenCalledTimes(1)
    expect(mockCreateRow).not.toHaveBeenCalled()
    expect(mockUpdateRow.mock.calls[0]?.[0]?.rowId).toBe('att-existing')
  })

  it('fails with a server AppError when the returned row does not match the schema', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [], total: 0 })
    mockCreateRow.mockResolvedValueOnce({ $id: 'bad' })

    const result = await upsertAttendance({
      userId: 'u1',
      date: '2026-08-01',
      status: 'present',
      createdBy: 'u2',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('nope', 403, 'forbidden'))

    const result = await upsertAttendance({
      userId: 'u1',
      date: '2026-08-01',
      status: 'present',
      createdBy: 'u2',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('forbidden')
  })
})

describe('listAttendance', () => {
  it('builds a paged, filtered query and parses rows', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [attendanceRow()], total: 1 })

    const result = await listAttendance({
      userId: 'u1',
      branchId: 'br-1',
      from: '2026-08-01',
      to: '2026-08-31',
      page: 0,
      pageSize: 31,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows).toHaveLength(1)

    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    const joined = queries.join(' ')
    expect(joined).toMatch(/user_id/)
    expect(joined).toMatch(/branch_id/)
    expect(joined).toMatch(/date/)
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('boom', 500, 'server_error'))
    const result = await listAttendance()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })
})
