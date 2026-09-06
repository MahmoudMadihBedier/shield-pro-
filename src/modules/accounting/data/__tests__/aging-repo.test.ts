import { AppwriteException } from '@/infrastructure/appwrite/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ok } from '@/core/result'

const { mockListRows, mockCustomerList } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockCustomerList: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('@/infrastructure/appwrite/testing')
  return { tablesDB: { listRows: mockListRows }, Query }
})

vi.mock('@/modules/admin', () => ({
  customersRepo: { list: mockCustomerList },
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

function receiptRow(over: Record<string, unknown> = {}) {
  return {
    $id: 'r1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'REC-2026-00001',
    doc_status: 1,
    branch_id: null,
    created_by: 'u1',
    amended_from: null,
    posting_datetime: '2026-08-10T00:00:00.000Z',
    remarks: null,
    invoice_ref: 'INV-2026-00001',
    customer_id: 'c1',
    amount: 200,
    method: 'cash',
    evidence_file_id: null,
    collected_by: 'u1',
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
  mockCustomerList.mockReset()
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
  it('joins customers + invoices + receipts and runs the domain reducer', async () => {
    routeByTable({
      sales_invoices: [invoiceRow({ net_total: 500 })],
      receipts: [receiptRow({ amount: 200 })],
    })
    mockCustomerList.mockResolvedValue(
      ok({ rows: [{ $id: 'c1', name: 'عميل تجريبي', credit_limit: 1000 }], total: 1 }),
    )

    const res = await customerAgingReport(new Date('2026-09-01T00:00:00.000Z'))

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

  it('propagates a customers-repo failure', async () => {
    routeByTable({ sales_invoices: [], receipts: [] })
    mockCustomerList.mockResolvedValue({
      ok: false,
      error: { code: 'forbidden', message: 'no' },
    })
    const res = await customerAgingReport(new Date())
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('forbidden')
  })
})
