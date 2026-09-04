import { AppwriteException } from 'appwrite'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows } = vi.hoisted(() => ({ mockListRows: vi.fn() }))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('appwrite')
  return { tablesDB: { listRows: mockListRows }, Query }
})

import { getBinQty, listBinBalances } from '../bin-balances-repo'

function binRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'bin-1',
    product_id: 'p1',
    warehouse_id: 'wh-a',
    qty: 12,
    updated_datetime: '2026-08-30T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
})

describe('listBinBalances', () => {
  it('builds a paged, warehouse+product filtered query and parses rows', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [binRow(), binRow({ $id: 'bin-2' })], total: 2 })

    const result = await listBinBalances({
      warehouseId: 'wh-a',
      productId: 'p1',
      page: 2,
      pageSize: 10,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows).toHaveLength(2)
    expect(result.value.total).toBe(2)

    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    const joined = queries.join(' ')
    expect(joined).toMatch(/limit.*10/)
    expect(joined).toMatch(/offset.*20/)
    expect(joined).toMatch(/warehouse_id/)
    expect(joined).toMatch(/product_id/)
  })

  it('adds a startsWith filter for a search term', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [], total: 0 })
    await listBinBalances({ search: 'p1' })
    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    expect(queries.join(' ')).toMatch(/product_id/)
  })

  it('fails with a server AppError when a row does not match the schema', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [{ $id: 'bad' }], total: 1 })
    const result = await listBinBalances()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('nope', 503, 'server_error'))
    const result = await listBinBalances()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })
})

describe('getBinQty', () => {
  it('returns the qty of the single matching bin row', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [binRow({ qty: 37 })], total: 1 })
    const result = await getBinQty('p1', 'wh-a')
    expect(result).toEqual({ ok: true, value: 37 })

    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    const joined = queries.join(' ')
    expect(joined).toMatch(/product_id/)
    expect(joined).toMatch(/warehouse_id/)
  })

  it('returns ok(0) when no bin row exists yet', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [], total: 0 })
    const result = await getBinQty('p1', 'wh-a')
    expect(result).toEqual({ ok: true, value: 0 })
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('boom', 401, 'unauthorized'))
    const result = await getBinQty('p1', 'wh-a')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unauthorized')
  })
})
