import { AppwriteException } from '@/infrastructure/appwrite/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ok } from '@/core/result'

const { mockListRows, mockFetchCustomerAging } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockFetchCustomerAging: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('@/infrastructure/appwrite/testing')
  return { tablesDB: { listRows: mockListRows }, Query }
})
vi.mock('@/infrastructure/appwrite/functions', () => ({
  fetchCustomerAging: (...a: unknown[]) => mockFetchCustomerAging(...a),
}))

import { customerAgingReport, listSubmittedInvoices } from '../aging-repo'

function invoiceRow(over: Record<string, unknown> = {}) {
  return {
    $id: 'i1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'INV-2026-00001',
    customer_id: 'c1',
    net_total: 500,
    payment_method: 'credit',
    posting_datetime: '2026-08-01T00:00:00.000Z',
    doc_status: 1,
    ...over,
  }
}

function routeByTable(handlers: Record<string, unknown>) {
  mockListRows.mockImplementation(async ({ tableId }: { tableId: string }) => {
    const rows = (handlers[tableId] as unknown[]) ?? []
    return { rows, total: rows.length }
  })
}

beforeEach(() => {
  mockListRows.mockReset()
  mockFetchCustomerAging.mockReset()
})

describe('listSubmittedInvoices', () => {
  it('always filters to Submitted and adds customer + date filters when given', async () => {
    routeByTable({ sales_invoices: [invoiceRow()] })

    const res = await listSubmittedInvoices({
      customerId: 'c1',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T00:00:00.000Z',
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toHaveLength(1)

    const queries = ((mockListRows.mock.calls[0]?.[0]?.queries ?? []) as string[]).join(' ')
    expect(queries).toMatch(/doc_status/)
    expect(queries).toMatch(/customer_id/)
    expect(queries).toMatch(/posting_datetime/)
  })

  it('returns a server AppError when an invoice row is malformed', async () => {
    routeByTable({ sales_invoices: [{ $id: 'bad' }] })
    const res = await listSubmittedInvoices()
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('server')
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('down', 503, 'server_error'))
    const res = await listSubmittedInvoices()
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('server')
  })
})

describe('customerAgingReport', () => {
  it('calls the aggregation RPC with the as-of ISO date and maps every row', async () => {
    mockFetchCustomerAging.mockResolvedValue(
      ok([
        {
          customerId: 'c1',
          customerName: 'عميل تجريبي',
          outstanding: 300,
          creditLimit: 1000,
          buckets: { '0-30': 300, '31-60': 0, '61-90': 0, '90+': 0 },
          oldestDays: 10,
        },
      ]),
    )

    const res = await customerAgingReport(new Date('2026-09-01T00:00:00.000Z'))

    expect(mockFetchCustomerAging).toHaveBeenCalledWith('2026-09-01T00:00:00.000Z')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toHaveLength(1)
    expect(res.value[0]).toMatchObject({
      customerId: 'c1',
      customerName: 'عميل تجريبي',
      creditLimit: 1000,
      outstanding: 300,
    })
  })

  it('propagates an RPC failure', async () => {
    mockFetchCustomerAging.mockResolvedValue({
      ok: false,
      error: { code: 'forbidden', message: 'no' },
    })
    const res = await customerAgingReport(new Date())
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('forbidden')
  })
})
