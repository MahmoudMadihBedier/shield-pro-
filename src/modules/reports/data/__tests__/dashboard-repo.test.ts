import { AppwriteException } from '@/infrastructure/appwrite/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ok } from '@/core/result'

const { mockListRows } = vi.hoisted(() => ({ mockListRows: vi.fn() }))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('@/infrastructure/appwrite/testing')
  return { tablesDB: { listRows: mockListRows }, Query }
})

const mockBranchesList = vi.fn()
const mockUsersList = vi.fn()
const mockProductsList = vi.fn()
const mockRawMaterialsList = vi.fn()

vi.mock('@/modules/admin', () => ({
  branchesRepo: { list: (...args: unknown[]) => mockBranchesList(...args) },
  usersRepo: { list: (...args: unknown[]) => mockUsersList(...args) },
  productsRepo: { list: (...args: unknown[]) => mockProductsList(...args) },
  rawMaterialsRepo: { list: (...args: unknown[]) => mockRawMaterialsList(...args) },
}))

const { fetchDashboardData } = await import('../dashboard-repo')

function invoiceRow(over: Record<string, unknown> = {}) {
  return {
    $id: 'inv-1',
    reference_id: 'INV-2026-00001',
    customer_id: 'c1',
    rep_user_id: 'rep-1',
    branch_id: 'br-1',
    lines: JSON.stringify([{ product_id: 'p1', qty: 2, net_price: 10 }]),
    net_total: 20,
    posting_datetime: '2026-08-15T00:00:00.000Z',
    ...over,
  }
}

function approvalRow(over: Record<string, unknown> = {}) {
  return {
    $id: 'appr-1',
    entity_ref: 'PO-1',
    created_at: '2026-08-01T00:00:00.000Z',
    ...over,
  }
}

function rawMaterial(over: Record<string, unknown> = {}) {
  return {
    $id: 'rm-1',
    $createdAt: 't',
    $updatedAt: 't',
    code: 'RM1',
    name: 'Flour',
    uom: 'kg',
    purchase_price: 5,
    preferred_supplier_id: null,
    reorder_point: 100,
    ...over,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
  mockBranchesList.mockReset()
  mockUsersList.mockReset()
  mockProductsList.mockReset()
  mockRawMaterialsList.mockReset()

  mockBranchesList.mockResolvedValue(ok({ rows: [], total: 0 }))
  mockUsersList.mockResolvedValue(ok({ rows: [], total: 0 }))
  mockProductsList.mockResolvedValue(ok({ rows: [], total: 0 }))
  mockRawMaterialsList.mockResolvedValue(ok({ rows: [rawMaterial()], total: 1 }))
})

describe('fetchDashboardData', () => {
  it('builds a submitted-only, date-bounded, newest-first invoice query and parses lines', async () => {
    mockListRows.mockImplementation(({ tableId }: { tableId: string }) => {
      if (tableId === 'sales_invoices') return Promise.resolve({ rows: [invoiceRow()], total: 1 })
      if (tableId === 'approval_requests') return Promise.resolve({ rows: [], total: 0 })
      if (tableId === 'bin_balances') return Promise.resolve({ rows: [], total: 0 })
      return Promise.resolve({ rows: [], total: 0 })
    })

    const res = await fetchDashboardData({ months: 3 })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.invoices).toHaveLength(1)
    expect(res.value.invoices[0]?.lines).toEqual([{ product_id: 'p1', qty: 2, net_price: 10 }])

    const invoiceCall = mockListRows.mock.calls.find(
      (call) => call[0]?.tableId === 'sales_invoices',
    )
    const queries = (invoiceCall?.[0]?.queries ?? []).join(' ')
    expect(queries).toMatch(/doc_status/)
    expect(queries).toMatch(/posting_datetime/)
    expect(queries).toMatch(/orderDesc.*posting_datetime/)
  })

  it('queries approval_requests for pending state only, oldest first', async () => {
    mockListRows.mockImplementation(({ tableId }: { tableId: string }) => {
      if (tableId === 'approval_requests') return Promise.resolve({ rows: [approvalRow()], total: 1 })
      return Promise.resolve({ rows: [], total: 0 })
    })

    const res = await fetchDashboardData()
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.pendingApprovals).toEqual([
      { $id: 'appr-1', entity_ref: 'PO-1', created_at: '2026-08-01T00:00:00.000Z' },
    ])

    const approvalCall = mockListRows.mock.calls.find(
      (call) => call[0]?.tableId === 'approval_requests',
    )
    const queries = (approvalCall?.[0]?.queries ?? []).join(' ')
    expect(queries).toMatch(/state/)
    expect(queries).toMatch(/orderAsc.*created_at/)
  })

  it('sums bin_balances qty per raw-material id across warehouses', async () => {
    mockListRows.mockImplementation(({ tableId }: { tableId: string }) => {
      if (tableId === 'bin_balances') {
        return Promise.resolve({
          rows: [
            { product_id: 'rm-1', warehouse_id: 'w1', qty: 10 },
            { product_id: 'rm-1', warehouse_id: 'w2', qty: 5 },
          ],
          total: 2,
        })
      }
      return Promise.resolve({ rows: [], total: 0 })
    })

    const res = await fetchDashboardData()
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.onHandByMaterial.get('rm-1')).toBe(15)
  })

  it('skips the bin_balances read when there are no raw materials', async () => {
    mockRawMaterialsList.mockResolvedValue(ok({ rows: [], total: 0 }))
    mockListRows.mockResolvedValue({ rows: [], total: 0 })

    const res = await fetchDashboardData()
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.onHandByMaterial.size).toBe(0)
    expect(mockListRows.mock.calls.some((call) => call[0]?.tableId === 'bin_balances')).toBe(false)
  })

  it('returns a server AppError when an invoice row fails the schema', async () => {
    mockListRows.mockImplementation(({ tableId }: { tableId: string }) => {
      if (tableId === 'sales_invoices') return Promise.resolve({ rows: [{ $id: 'bad' }], total: 1 })
      return Promise.resolve({ rows: [], total: 0 })
    })

    const res = await fetchDashboardData()
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('server')
  })

  it('returns a server AppError when lines JSON is malformed', async () => {
    mockListRows.mockImplementation(({ tableId }: { tableId: string }) => {
      if (tableId === 'sales_invoices') {
        return Promise.resolve({ rows: [invoiceRow({ lines: '{not json' })], total: 1 })
      }
      return Promise.resolve({ rows: [], total: 0 })
    })

    const res = await fetchDashboardData()
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('server')
  })

  it('maps an Appwrite failure on the invoice read to a typed AppError', async () => {
    mockListRows.mockImplementation(({ tableId }: { tableId: string }) => {
      if (tableId === 'sales_invoices') {
        return Promise.reject(new AppwriteException('nope', 403, 'forbidden'))
      }
      return Promise.resolve({ rows: [], total: 0 })
    })

    const res = await fetchDashboardData()
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('forbidden')
  })
})
