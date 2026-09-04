import { beforeEach, describe, expect, it, vi } from 'vitest'

import { appError } from '@/core/errors'
import { err, ok } from '@/core/result'

const postStockLedger = vi.fn()
const postGl = vi.fn()

vi.mock('@/infrastructure/appwrite/functions', () => ({
  postStockLedger: (...a: unknown[]) => postStockLedger(...a),
  postGl: (...a: unknown[]) => postGl(...a),
}))

const { postInvoiceToLedger, postRepIssueToLedger } = await import('../post-sales')
const { serializeJsonArray } = await import('../../domain/schemas')
import type { RepStockIssueRow, SalesInvoiceRow } from '../../domain/schemas'

function invoice(overrides: Partial<SalesInvoiceRow> = {}): SalesInvoiceRow {
  return {
    $id: 'row-1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'INV-2026-00042',
    doc_status: 1,
    branch_id: 'br-1',
    created_by: 'user-1',
    amended_from: null,
    posting_datetime: '2026-08-31T09:00:00.000Z',
    remarks: null,
    customer_id: 'cust-1',
    rep_user_id: 'rep-1',
    lines: serializeJsonArray([
      { product_id: 'p1', qty: 2, base_price: 100, discount_pct: 10, net_price: 90 },
    ]),
    gross_total: 200,
    discount_total: 20,
    net_total: 180,
    payment_method: 'cash',
    cash_amount: 180,
    credit_amount: 0,
    bank_reference: null,
    geo: '30.04,31.23',
    sold_by: 'rep-1',
    cashup_confirmed_by: null,
    ...overrides,
  }
}

function repIssue(overrides: Partial<RepStockIssueRow> = {}): RepStockIssueRow {
  return {
    $id: 'iss-1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'ISS-2026-00007',
    doc_status: 1,
    branch_id: 'br-1',
    created_by: 'user-1',
    amended_from: null,
    posting_datetime: '2026-08-31T08:00:00.000Z',
    remarks: null,
    sub_warehouse_id: 'wh-sub',
    rep_user_id: 'rep-1',
    lines: serializeJsonArray([{ product_id: 'p1', qty: 5, lot_number: 'L-1' }]),
    status: 'approved',
    requested_by: 'rep-1',
    approved_by: 'mgr-1',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('postInvoiceToLedger — the two-step', () => {
  it('posts stock then GL under the same voucher_no, in order', async () => {
    postStockLedger.mockResolvedValue(ok({ voucherNo: 'INV-2026-00042', entries: 1, balances: [] }))
    postGl.mockResolvedValue(ok({ voucherNo: 'INV-2026-00042', entries: 2 }))

    const res = await postInvoiceToLedger(invoice(), 'wh-rep')

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value).toEqual({
      voucherNo: 'INV-2026-00042',
      stockAlreadyPosted: false,
      glAlreadyPosted: false,
      stock: { voucherNo: 'INV-2026-00042', entries: 1, balances: [] },
      gl: { voucherNo: 'INV-2026-00042', entries: 2 },
    })

    expect(postStockLedger).toHaveBeenCalledWith({
      voucherType: 'SalesInvoice',
      voucherNo: 'INV-2026-00042',
      postingDatetime: '2026-08-31T09:00:00.000Z',
      moves: [{ productId: 'p1', warehouseId: 'wh-rep', qtyChange: -2, valuationRate: 90 }],
    })
    expect(postGl).toHaveBeenCalledWith({
      voucherType: 'SalesInvoice',
      voucherNo: 'INV-2026-00042',
      postingDatetime: '2026-08-31T09:00:00.000Z',
      branchId: 'br-1',
      lines: [
        { account: 'cash', debit: 180, credit: 0 },
        { account: 'sales_revenue', debit: 0, credit: 180 },
      ],
    })
    expect(postStockLedger.mock.invocationCallOrder[0]).toBeLessThan(
      postGl.mock.invocationCallOrder[0]!,
    )
  })

  it('still attempts the GL post when the stock post 409s', async () => {
    postStockLedger.mockResolvedValue(err(appError('conflict', 'already posted')))
    postGl.mockResolvedValue(ok({ voucherNo: 'INV-2026-00042', entries: 2 }))

    const res = await postInvoiceToLedger(invoice(), 'wh-rep')

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.stockAlreadyPosted).toBe(true)
    expect(res.value.glAlreadyPosted).toBe(false)
    expect(postGl).toHaveBeenCalledOnce()
  })

  it('absorbs a 409 on both halves as a fully-posted no-op', async () => {
    postStockLedger.mockResolvedValue(err(appError('conflict', 'x')))
    postGl.mockResolvedValue(err(appError('conflict', 'x')))

    const res = await postInvoiceToLedger(invoice(), 'wh-rep')

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.stockAlreadyPosted).toBe(true)
    expect(res.value.glAlreadyPosted).toBe(true)
  })

  it('propagates a non-conflict stock failure and never calls GL', async () => {
    postStockLedger.mockResolvedValue(err(appError('server', 'ledger down')))

    const res = await postInvoiceToLedger(invoice(), 'wh-rep')

    expect(res).toEqual(err(appError('server', 'ledger down')))
    expect(postGl).not.toHaveBeenCalled()
  })

  it('propagates a non-conflict GL failure', async () => {
    postStockLedger.mockResolvedValue(ok({ voucherNo: 'INV-2026-00042', entries: 1, balances: [] }))
    postGl.mockResolvedValue(err(appError('validation', 'unbalanced')))

    const res = await postInvoiceToLedger(invoice(), 'wh-rep')

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('validation')
  })

  it('routes a partial invoice to cash + AR debits', async () => {
    postStockLedger.mockResolvedValue(ok({ voucherNo: 'INV-2026-00042', entries: 1, balances: [] }))
    postGl.mockResolvedValue(ok({ voucherNo: 'INV-2026-00042', entries: 3 }))

    await postInvoiceToLedger(
      invoice({ payment_method: 'partial', cash_amount: 50, credit_amount: 130 }),
      'wh-rep',
    )

    expect(postGl.mock.calls[0]?.[0]?.lines).toEqual([
      { account: 'cash', debit: 50, credit: 0 },
      { account: 'accounts_receivable', debit: 130, credit: 0 },
      { account: 'sales_revenue', debit: 0, credit: 180 },
    ])
  })
})

describe('postRepIssueToLedger', () => {
  it('posts the sub → rep custody moves under the issue voucher', async () => {
    postStockLedger.mockResolvedValue(ok({ voucherNo: 'ISS-2026-00007', entries: 2, balances: [] }))

    const res = await postRepIssueToLedger(repIssue(), {
      fromSubWarehouseId: 'wh-sub',
      repCustodyWarehouseId: 'wh-rep',
    })

    expect(res.ok).toBe(true)
    expect(postStockLedger).toHaveBeenCalledWith({
      voucherType: 'RepStockIssue',
      voucherNo: 'ISS-2026-00007',
      postingDatetime: '2026-08-31T08:00:00.000Z',
      moves: [
        { productId: 'p1', warehouseId: 'wh-sub', lotNumber: 'L-1', qtyChange: -5 },
        { productId: 'p1', warehouseId: 'wh-rep', lotNumber: 'L-1', qtyChange: 5 },
      ],
    })
  })

  it('absorbs a re-post conflict', async () => {
    postStockLedger.mockResolvedValue(err(appError('conflict', 'x')))
    const res = await postRepIssueToLedger(repIssue(), {
      fromSubWarehouseId: 'wh-sub',
      repCustodyWarehouseId: 'wh-rep',
    })
    expect(res).toEqual(ok({ voucherNo: 'ISS-2026-00007', alreadyPosted: true, posted: null }))
  })
})
