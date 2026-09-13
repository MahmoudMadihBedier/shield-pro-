import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppwriteException } from '@/infrastructure/appwrite/testing'

const { mockListRows, mockProductsList } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockProductsList: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query, ID } = await import('@/infrastructure/appwrite/testing')
  return { tablesDB: { listRows: mockListRows }, Query, ID }
})
vi.mock('@/modules/admin', () => ({
  productsRepo: { list: (...a: unknown[]) => mockProductsList(...a) },
}))

import { listProductsByIds, listSubmittedBatchesInRange } from '../waste-report-repo'

function batchRow(over: Record<string, unknown> = {}) {
  return {
    $id: 'b1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'MFB-0001',
    doc_status: 1,
    branch_id: 'br1',
    created_by: 'u1',
    amended_from: null,
    posting_datetime: '2026-03-01T00:00:00.000Z',
    remarks: null,
    production_request_ref: null,
    product_id: 'p1',
    lot_number: 'L1',
    produced_qty: 90,
    waste_qty: 10,
    raw_material_lots: '[]',
    expected_cost: 0,
    expected_profit: 0,
    qc_status: 'released',
    qc_by: null,
    expiry_date: null,
    ...over,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
  mockProductsList.mockReset()
})

describe('listSubmittedBatchesInRange', () => {
  it('always filters to doc_status Submitted and pushes an optional date range into the query', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [batchRow()], total: 1 })

    const res = await listSubmittedBatchesInRange({
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-31T23:59:59.999Z',
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.rows).toHaveLength(1)
    expect(res.value.total).toBe(1)

    const queries = (mockListRows.mock.calls[0]?.[0]?.queries ?? []).join(' ')
    expect(queries).toMatch(/doc_status/)
    expect(queries).toMatch(/posting_datetime/)
  })

  it('does not add a date-range filter when from/to are omitted', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [], total: 0 })
    await listSubmittedBatchesInRange()
    const queries = (mockListRows.mock.calls[0]?.[0]?.queries ?? []).join(' ')
    expect(queries).toMatch(/doc_status/)
    expect(queries).not.toMatch(/greaterThanEqual|lessThanEqual/)
  })

  it('returns a server AppError when a batch row is malformed', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [{ $id: 'bad' }], total: 1 })
    const res = await listSubmittedBatchesInRange()
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('server')
  })

  it('maps a transport failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('down', 503, 'server_error'))
    const res = await listSubmittedBatchesInRange()
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('server')
  })
})

describe('listProductsByIds', () => {
  it('dedupes ids and filters by $id', async () => {
    mockProductsList.mockResolvedValueOnce({
      ok: true,
      value: { rows: [{ $id: 'p1', name: 'زبادي' }], total: 1 },
    })

    const res = await listProductsByIds(['p1', 'p1', 'p1'])

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual([{ $id: 'p1', name: 'زبادي' }])
    expect(mockProductsList).toHaveBeenCalledTimes(1)
    expect(mockProductsList).toHaveBeenCalledWith(
      expect.objectContaining({ filters: [{ field: '$id', value: ['p1'] }] }),
    )
  })

  it('chunks ids past the per-query limit', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `p${i}`)
    mockProductsList.mockResolvedValue({ ok: true, value: { rows: [], total: 0 } })

    const res = await listProductsByIds(ids)

    expect(res.ok).toBe(true)
    expect(mockProductsList).toHaveBeenCalledTimes(2)
  })

  it('propagates a lookup failure', async () => {
    mockProductsList.mockResolvedValueOnce({
      ok: false,
      error: { code: 'server', message: 'down' },
    })
    const res = await listProductsByIds(['p1'])
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('server')
  })

  it('is a no-op for an empty id list', async () => {
    const res = await listProductsByIds([])
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual([])
    expect(mockProductsList).not.toHaveBeenCalled()
  })
})
