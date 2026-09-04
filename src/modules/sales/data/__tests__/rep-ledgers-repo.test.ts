import { AppwriteException } from 'appwrite'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows } = vi.hoisted(() => ({ mockListRows: vi.fn() }))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('appwrite')
  return { tablesDB: { listRows: mockListRows }, Query }
})

import {
  listRepCashLedger,
  listRepStockLedger,
  repCashBalance,
  repStockBalance,
} from '../rep-ledgers-repo'

function stockRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'rsl-1',
    $createdAt: 't',
    $updatedAt: 't',
    rep_user_id: 'rep-1',
    product_id: 'p1',
    voucher_no: 'INV-2026-00001',
    qty_change: -2,
    qty_after: 8,
    posting_datetime: '2026-08-31T10:00:00.000Z',
    ...overrides,
  }
}

function cashRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'rcl-1',
    $createdAt: 't',
    $updatedAt: 't',
    rep_user_id: 'rep-1',
    voucher_no: 'INV-2026-00001',
    method: 'cash',
    amount_change: 90,
    amount_after: 90,
    posting_datetime: '2026-08-31T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
})

describe('listRepStockLedger', () => {
  it('filters by rep + product, orders newest-first and pages', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [stockRow()], total: 1 })

    const res = await listRepStockLedger({
      repUserId: 'rep-1',
      productId: 'p1',
      page: 2,
      pageSize: 10,
    })

    expect(res.ok).toBe(true)
    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    const joined = queries.join(' ')
    expect(joined).toMatch(/rep_user_id/)
    expect(joined).toMatch(/product_id/)
    expect(joined).toMatch(/posting_datetime/)
    expect(joined).toMatch(/limit.*10/)
    expect(joined).toMatch(/offset.*20/)
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('nope', 503, 'server_error'))
    const res = await listRepStockLedger({ repUserId: 'rep-1' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('server')
  })

  it('fails with a server AppError on a malformed row', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [{ $id: 'bad' }], total: 1 })
    const res = await listRepStockLedger({ repUserId: 'rep-1' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('server')
  })
})

describe('listRepCashLedger', () => {
  it('adds a method filter when given', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [cashRow()], total: 1 })
    await listRepCashLedger({ repUserId: 'rep-1', method: 'bank_transfer' })
    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    expect(queries.join(' ')).toMatch(/method/)
  })
})

describe('repStockBalance', () => {
  it('keeps the latest qty_after per product (rows are newest-first)', async () => {
    mockListRows.mockResolvedValueOnce({
      rows: [
        stockRow({ product_id: 'p1', qty_after: 8, posting_datetime: '2026-08-31T12:00:00.000Z' }),
        stockRow({ product_id: 'p1', qty_after: 10, posting_datetime: '2026-08-31T09:00:00.000Z' }),
        stockRow({ product_id: 'p2', qty_after: 3, posting_datetime: '2026-08-31T08:00:00.000Z' }),
      ],
      total: 3,
    })
    const res = await repStockBalance('rep-1')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual([
      { product_id: 'p1', qty_after: 8, posting_datetime: '2026-08-31T12:00:00.000Z' },
      { product_id: 'p2', qty_after: 3, posting_datetime: '2026-08-31T08:00:00.000Z' },
    ])
  })
})

describe('repCashBalance', () => {
  it('keeps the latest amount_after per method', async () => {
    mockListRows.mockResolvedValueOnce({
      rows: [
        cashRow({ method: 'cash', amount_after: 500 }),
        cashRow({ method: 'cash', amount_after: 400 }),
        cashRow({ method: 'bank_transfer', amount_after: 200 }),
      ],
      total: 3,
    })
    const res = await repCashBalance('rep-1')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual([
      { method: 'cash', amount_after: 500, posting_datetime: '2026-08-31T10:00:00.000Z' },
      { method: 'bank_transfer', amount_after: 200, posting_datetime: '2026-08-31T10:00:00.000Z' },
    ])
  })
})
