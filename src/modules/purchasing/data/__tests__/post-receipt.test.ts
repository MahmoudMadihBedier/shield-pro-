import { beforeEach, describe, expect, it, vi } from 'vitest'

import { appError } from '@/core/errors'
import { err, ok } from '@/core/result'

const postStockLedger = vi.fn()

vi.mock('@/infrastructure/appwrite/functions', () => ({
  postStockLedger: (...args: unknown[]) => postStockLedger(...args),
}))

const { postReceiptToLedger } = await import('../post-receipt')
const { serializeLines } = await import('../../domain/lines')
import type { StockReceipt } from '../../domain/schemas'

function receipt(overrides: Partial<StockReceipt> = {}): StockReceipt {
  return {
    $id: 'row-1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'SR-2026-00007',
    doc_status: 1,
    branch_id: null,
    created_by: 'user-1',
    amended_from: null,
    posting_datetime: '2026-08-31T09:00:00.000Z',
    remarks: null,
    purchase_order_ref: 'PO-2026-00003',
    supplier_lot_number: 'LOT-7',
    lines: serializeLines([{ raw_material_id: 'rm-1', qty: 4, unit_price: 25 }]),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('postReceiptToLedger', () => {
  it('calls /post-stock-ledger with the receipt voucher + mapped moves', async () => {
    postStockLedger.mockResolvedValue(
      ok({
        voucherNo: 'SR-2026-00007',
        entries: 1,
        balances: [{ productId: 'rm-1', warehouseId: 'wh-raw', qtyAfter: 4 }],
      }),
    )

    const res = await postReceiptToLedger(receipt(), 'wh-raw')

    expect(res).toEqual(
      ok({
        alreadyPosted: false,
        result: {
          voucherNo: 'SR-2026-00007',
          entries: 1,
          balances: [{ productId: 'rm-1', warehouseId: 'wh-raw', qtyAfter: 4 }],
        },
      }),
    )
    expect(postStockLedger).toHaveBeenCalledWith({
      voucherType: 'StockReceipt',
      voucherNo: 'SR-2026-00007',
      postingDatetime: '2026-08-31T09:00:00.000Z',
      moves: [
        {
          productId: 'rm-1',
          warehouseId: 'wh-raw',
          lotNumber: 'LOT-7',
          qtyChange: 4,
          valuationRate: 25,
        },
      ],
    })
  })

  it('treats a re-post conflict as a benign "already posted" success', async () => {
    postStockLedger.mockResolvedValue(err(appError('conflict', 'already posted')))

    const res = await postReceiptToLedger(receipt(), 'wh-raw')

    expect(res).toEqual(ok({ alreadyPosted: true, result: null }))
  })

  it('passes a non-conflict failure straight through', async () => {
    const failure = appError('server', 'ledger down')
    postStockLedger.mockResolvedValue(err(failure))

    const res = await postReceiptToLedger(receipt(), 'wh-raw')

    expect(res).toEqual(err(failure))
  })

  it('rejects a receipt with no lines before calling the server', async () => {
    const res = await postReceiptToLedger(receipt({ lines: '[]' }), 'wh-raw')

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('validation')
    expect(postStockLedger).not.toHaveBeenCalled()
  })
})
