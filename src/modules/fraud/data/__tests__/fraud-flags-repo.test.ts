import { AppwriteException } from '@/infrastructure/appwrite/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows, mockGetRow } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockGetRow: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('@/infrastructure/appwrite/testing')
  return { tablesDB: { listRows: mockListRows, getRow: mockGetRow }, Query }
})

import { getFraudFlag, listFraudFlags } from '../fraud-flags-repo'

function flagRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'flag-1',
    $createdAt: '2026-09-01T09:00:00.000Z',
    $updatedAt: '2026-09-01T09:00:00.000Z',
    kind: 'round_tripping',
    subject_type: 'product_warehouse',
    subject_id: 'p1:wh1',
    detail: 'round-tripped stock',
    status: 'open',
    created_at: '2026-09-01T09:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
  mockGetRow.mockReset()
})

describe('listFraudFlags', () => {
  it('builds a paged, status+kind filtered query and parses rows', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [flagRow(), flagRow({ $id: 'flag-2' })], total: 2 })

    const result = await listFraudFlags({
      status: 'open',
      kind: 'round_tripping',
      page: 1,
      pageSize: 10,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows).toHaveLength(2)
    expect(result.value.total).toBe(2)

    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    const joined = queries.join(' ')
    expect(joined).toMatch(/limit.*10/)
    expect(joined).toMatch(/offset.*10/)
    expect(joined).toMatch(/status/)
    expect(joined).toMatch(/kind/)
  })

  it('fails with a server AppError when a row does not match the schema', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [{ $id: 'bad' }], total: 1 })
    const result = await listFraudFlags()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('nope', 503, 'server_error'))
    const result = await listFraudFlags()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })
})

describe('getFraudFlag', () => {
  it('returns the parsed row', async () => {
    mockGetRow.mockResolvedValueOnce(flagRow())
    const result = await getFraudFlag('flag-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.$id).toBe('flag-1')
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockGetRow.mockRejectedValueOnce(new AppwriteException('nope', 404, 'not_found'))
    const result = await getFraudFlag('missing')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not_found')
  })
})
