import { AppwriteException } from 'appwrite'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows } = vi.hoisted(() => ({ mockListRows: vi.fn() }))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('appwrite')
  return { tablesDB: { listRows: mockListRows }, Query }
})

import { listEmployees } from '../employees-repo'

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'u1',
    $createdAt: 't',
    $updatedAt: 't',
    auth_user_id: 'auth-1',
    full_name: 'محمد أحمد',
    roles: 'sales_rep',
    branch_id: 'br-1',
    sub_warehouse_id: null,
    job_grade: 'grade-2',
    is_active: true,
    base_salary: 5000,
    ...overrides,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
})

describe('listEmployees', () => {
  it('defaults to active employees only and parses base_salary', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [userRow()], total: 1 })

    const result = await listEmployees()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows).toHaveLength(1)
    expect(result.value.rows[0]?.base_salary).toBe(5000)

    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    expect(queries.join(' ')).toMatch(/is_active/)
  })

  it('defaults base_salary to 0 when the column is missing', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [userRow({ base_salary: undefined })], total: 1 })
    const result = await listEmployees()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows[0]?.base_salary).toBe(0)
  })

  it('filters by branch when branchId is given', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [], total: 0 })
    await listEmployees({ branchId: 'br-1' })
    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    expect(queries.join(' ')).toMatch(/branch_id/)
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('nope', 401, 'unauthorized'))
    const result = await listEmployees()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unauthorized')
  })

  it('fails with a server AppError when a row does not match the schema', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [{ $id: 'bad' }], total: 1 })
    const result = await listEmployees()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })
})
