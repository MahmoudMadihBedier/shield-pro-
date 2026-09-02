import { AppwriteException } from 'appwrite'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUpdateRow } = vi.hoisted(() => ({ mockUpdateRow: vi.fn() }))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('appwrite')
  return {
    Query,
    ID: { unique: () => 'generated-id' },
    tablesDB: { updateRow: mockUpdateRow, listRows: vi.fn(), getRow: vi.fn(), createRow: vi.fn() },
  }
})

import { usersRepo } from '../users-repo'

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'u1',
    $createdAt: 't',
    $updatedAt: 't',
    auth_user_id: 'auth-1',
    full_name: 'أحمد',
    roles: 'sales_rep',
    branch_id: null,
    sub_warehouse_id: null,
    job_grade: null,
    is_active: true,
    ...overrides,
  }
}

beforeEach(() => {
  mockUpdateRow.mockReset()
})

describe('usersRepo.setBranch', () => {
  it('writes the branch_id column and returns the parsed user', async () => {
    mockUpdateRow.mockResolvedValueOnce(userRow({ branch_id: 'br-cairo' }))

    const result = await usersRepo.setBranch('u1', 'br-cairo')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.branch_id).toBe('br-cairo')
    expect(mockUpdateRow.mock.calls[0]?.[0]).toEqual({
      databaseId: 'shield_pro',
      tableId: 'users',
      rowId: 'u1',
      data: { branch_id: 'br-cairo' },
    })
  })

  it('unbinds the branch when passed null', async () => {
    mockUpdateRow.mockResolvedValueOnce(userRow({ branch_id: null }))
    const result = await usersRepo.setBranch('u1', null)
    expect(result.ok).toBe(true)
    expect(mockUpdateRow.mock.calls[0]?.[0]?.data).toEqual({ branch_id: null })
  })

  it('maps a raw Appwrite failure to a typed AppError', async () => {
    mockUpdateRow.mockRejectedValueOnce(new AppwriteException('nope', 403, 'unauthorized'))
    const result = await usersRepo.setBranch('u1', 'br-cairo')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('forbidden')
  })
})
