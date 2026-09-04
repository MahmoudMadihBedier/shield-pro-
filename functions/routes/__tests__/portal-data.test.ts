import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { FnError } from '../../common/handler'
import {
  getPortalInvoiceDetail,
  getPortalMe,
  listPortalInvoices,
  listPortalReceipts,
} from '../portal-data'

const CUSTOMER_MATCH = {
  total: 1,
  rows: [{ $id: 'cust-1', code: 'CUST001', name: 'Acme Foods', branch_id: 'cairo' }],
}
const NO_CUSTOMER_MATCH = { total: 0, rows: [] }

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  // Default: `requireCustomerCaller`'s listRows lookup resolves to cust-1.
  return { listRows: vi.fn().mockResolvedValue(CUSTOMER_MATCH), ...over } as unknown as TablesDB
}

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'inv-1',
    customer_id: 'cust-1',
    reference_id: 'INV-2026-00001',
    lines: '[]',
    gross_total: 100,
    discount_total: 0,
    net_total: 100,
    payment_method: 'cash',
    posting_datetime: '2026-09-01T00:00:00.000Z',
    doc_status: 1,
    ...overrides,
  }
}

describe('portal-data — no linked account', () => {
  it('getPortalMe rejects an anonymous caller', async () => {
    await expect(getPortalMe(fakeDb({}), null)).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('getPortalMe rejects a caller with no linked customer', async () => {
    const db = fakeDb({ listRows: vi.fn().mockResolvedValue(NO_CUSTOMER_MATCH) })
    await expect(getPortalMe(db, 'auth-1')).rejects.toBeInstanceOf(FnError)
    await expect(getPortalMe(db, 'auth-1')).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('listPortalInvoices rejects a caller with no linked customer', async () => {
    const db = fakeDb({ listRows: vi.fn().mockResolvedValue(NO_CUSTOMER_MATCH) })
    await expect(listPortalInvoices(db, {}, 'auth-1')).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('listPortalReceipts rejects a caller with no linked customer', async () => {
    const db = fakeDb({ listRows: vi.fn().mockResolvedValue(NO_CUSTOMER_MATCH) })
    await expect(listPortalReceipts(db, {}, 'auth-1')).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('getPortalInvoiceDetail rejects a caller with no linked customer', async () => {
    const db = fakeDb({ listRows: vi.fn().mockResolvedValue(NO_CUSTOMER_MATCH) })
    await expect(
      getPortalInvoiceDetail(db, { invoiceId: 'inv-1' }, 'auth-1'),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })
})

describe('getPortalMe', () => {
  it('returns the linked customer profile', async () => {
    const getRow = vi.fn().mockResolvedValue({ phone: '0100000000' })
    const me = await getPortalMe(fakeDb({ getRow }), 'auth-1')
    expect(me).toEqual({
      customerId: 'cust-1',
      code: 'CUST001',
      name: 'Acme Foods',
      phone: '0100000000',
      branchId: 'cairo',
    })
  })

  it('reports a null phone when none is on file', async () => {
    const getRow = vi.fn().mockResolvedValue({})
    const me = await getPortalMe(fakeDb({ getRow }), 'auth-1')
    expect(me.phone).toBeNull()
  })
})

describe('listPortalInvoices', () => {
  it('scopes the query to the caller-linked customer_id', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(CUSTOMER_MATCH) // requireCustomerCaller lookup
      .mockResolvedValueOnce({ total: 1, rows: [invoiceRow()] }) // the invoice list itself

    const result = await listPortalInvoices(fakeDb({ listRows }), {}, 'auth-1')

    expect(result.total).toBe(1)
    expect(result.rows).toEqual([
      {
        id: 'inv-1',
        referenceId: 'INV-2026-00001',
        docStatus: 1,
        netTotal: 100,
        paymentMethod: 'cash',
        postingDatetime: '2026-09-01T00:00:00.000Z',
      },
    ])

    const invoiceListCall = listRows.mock.calls[1]?.[0] as { queries: string[] }
    expect(invoiceListCall.queries.some((q) => q.includes('cust-1'))).toBe(true)
  })

  it('defaults to page 0, pageSize 25', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(CUSTOMER_MATCH)
      .mockResolvedValueOnce({ total: 0, rows: [] })

    await listPortalInvoices(fakeDb({ listRows }), {}, 'auth-1')

    const invoiceListCall = listRows.mock.calls[1]?.[0] as { queries: string[] }
    expect(invoiceListCall.queries.some((q) => q.includes('"limit"') && q.includes('25'))).toBe(
      true,
    )
    expect(invoiceListCall.queries.some((q) => q.includes('"offset"') && q.includes('0'))).toBe(
      true,
    )
  })

  it('clamps an oversized pageSize to the max', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(CUSTOMER_MATCH)
      .mockResolvedValueOnce({ total: 0, rows: [] })

    await listPortalInvoices(fakeDb({ listRows }), { pageSize: 5000 }, 'auth-1')

    const invoiceListCall = listRows.mock.calls[1]?.[0] as { queries: string[] }
    expect(invoiceListCall.queries.some((q) => q.includes('"limit"') && q.includes('100'))).toBe(
      true,
    )
  })
})

describe('getPortalInvoiceDetail', () => {
  it('rejects an invoice belonging to another customer', async () => {
    const getRow = vi.fn().mockResolvedValue(invoiceRow({ customer_id: 'someone-else' }))
    await expect(
      getPortalInvoiceDetail(fakeDb({ getRow }), { invoiceId: 'inv-1' }, 'auth-1'),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('returns the full detail for the caller-owned invoice', async () => {
    const getRow = vi.fn().mockResolvedValue(invoiceRow())
    const detail = await getPortalInvoiceDetail(
      fakeDb({ getRow }),
      { invoiceId: 'inv-1' },
      'auth-1',
    )
    expect(detail).toEqual({
      id: 'inv-1',
      referenceId: 'INV-2026-00001',
      lines: '[]',
      grossTotal: 100,
      discountTotal: 0,
      netTotal: 100,
      paymentMethod: 'cash',
      postingDatetime: '2026-09-01T00:00:00.000Z',
      docStatus: 1,
    })
  })

  it('maps a missing invoice to not_found', async () => {
    const getRow = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { code: 404 }))
    await expect(
      getPortalInvoiceDetail(fakeDb({ getRow }), { invoiceId: 'ghost' }, 'auth-1'),
    ).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('listPortalReceipts', () => {
  it('scopes the query to the caller-linked customer_id and defaults pagination', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(CUSTOMER_MATCH)
      .mockResolvedValueOnce({
        total: 1,
        rows: [
          {
            $id: 'rcpt-1',
            customer_id: 'cust-1',
            invoice_ref: 'INV-2026-00001',
            amount: 50,
            method: 'cash',
            posting_datetime: '2026-09-02T00:00:00.000Z',
            doc_status: 1,
          },
        ],
      })

    const result = await listPortalReceipts(fakeDb({ listRows }), {}, 'auth-1')

    expect(result).toEqual({
      total: 1,
      rows: [
        {
          id: 'rcpt-1',
          invoiceRef: 'INV-2026-00001',
          amount: 50,
          method: 'cash',
          postingDatetime: '2026-09-02T00:00:00.000Z',
          docStatus: 1,
        },
      ],
    })

    const receiptListCall = listRows.mock.calls[1]?.[0] as { queries: string[] }
    expect(receiptListCall.queries.some((q) => q.includes('cust-1'))).toBe(true)
    expect(receiptListCall.queries.some((q) => q.includes('"limit"') && q.includes('25'))).toBe(
      true,
    )
  })
})
