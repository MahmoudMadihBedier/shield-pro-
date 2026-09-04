import { beforeEach, describe, expect, it, vi } from 'vitest'

import { appError } from '@/core/errors'
import { err, ok } from '@/core/result'

const postGl = vi.fn()

vi.mock('@/infrastructure/appwrite/functions', () => ({
  postGl: (...args: unknown[]) => postGl(...args),
}))

const { postReceiptToGl, postVoucherToGl } = await import('../post-accounting')
import type { PaymentVoucher, Receipt } from '../../domain/schemas'

function receipt(over: Partial<Receipt> = {}): Receipt {
  return {
    $id: 'r1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'REC-2026-00007',
    doc_status: 1,
    branch_id: 'br-1',
    created_by: 'u1',
    amended_from: null,
    posting_datetime: '2026-08-31T09:00:00.000Z',
    remarks: null,
    invoice_ref: 'INV-2026-00003',
    customer_id: 'c1',
    amount: 250,
    method: 'cash',
    evidence_file_id: null,
    collected_by: 'u1',
    ...over,
  }
}

function voucher(over: Partial<PaymentVoucher> = {}): PaymentVoucher {
  return {
    $id: 'v1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'PV-2026-00009',
    doc_status: 1,
    branch_id: null,
    created_by: 'u1',
    amended_from: null,
    posting_datetime: '2026-08-31T09:00:00.000Z',
    remarks: null,
    direction: 'payment',
    amount: 400,
    reason: 'مصروف نقل',
    counterparty: 'شركة النقل',
    treasury_account: null,
    evidence_file_id: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('postReceiptToGl', () => {
  it('calls /post-gl with voucherType Receipt, the reference id and balanced lines', async () => {
    postGl.mockResolvedValue(ok({ voucherNo: 'REC-2026-00007', entries: 2 }))

    const res = await postReceiptToGl(receipt())

    expect(res).toEqual(
      ok({
        voucherNo: 'REC-2026-00007',
        alreadyPosted: false,
        posted: { voucherNo: 'REC-2026-00007', entries: 2 },
      }),
    )
    expect(postGl).toHaveBeenCalledWith({
      voucherType: 'Receipt',
      voucherNo: 'REC-2026-00007',
      postingDatetime: '2026-08-31T09:00:00.000Z',
      branchId: 'br-1',
      lines: [
        { account: 'cash', debit: 250, credit: 0 },
        { account: 'accounts_receivable', debit: 0, credit: 250 },
      ],
    })
  })

  it('absorbs a 409 conflict as a benign already-posted success', async () => {
    postGl.mockResolvedValue(err(appError('conflict', 'already posted')))
    const res = await postReceiptToGl(receipt())
    expect(res).toEqual(ok({ voucherNo: 'REC-2026-00007', alreadyPosted: true, posted: null }))
  })

  it('passes a non-conflict failure straight through', async () => {
    const failure = appError('server', 'gl down')
    postGl.mockResolvedValue(err(failure))
    const res = await postReceiptToGl(receipt())
    expect(res).toEqual(err(failure))
  })
})

describe('postVoucherToGl', () => {
  it('calls /post-gl with voucherType PaymentVoucher and direction-correct lines', async () => {
    postGl.mockResolvedValue(ok({ voucherNo: 'PV-2026-00009', entries: 2 }))

    await postVoucherToGl(voucher())

    expect(postGl).toHaveBeenCalledWith({
      voucherType: 'PaymentVoucher',
      voucherNo: 'PV-2026-00009',
      postingDatetime: '2026-08-31T09:00:00.000Z',
      branchId: null,
      lines: [
        { account: 'expense', debit: 400, credit: 0 },
        { account: 'treasury', debit: 0, credit: 400 },
      ],
    })
  })

  it('absorbs a conflict for the voucher path too', async () => {
    postGl.mockResolvedValue(err(appError('conflict', 'dup')))
    const res = await postVoucherToGl(voucher())
    expect(res).toEqual(ok({ voucherNo: 'PV-2026-00009', alreadyPosted: true, posted: null }))
  })
})
