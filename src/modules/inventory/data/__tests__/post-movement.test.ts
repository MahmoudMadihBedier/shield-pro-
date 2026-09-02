import { beforeEach, describe, expect, it, vi } from 'vitest'

import { appError } from '@/core/errors'
import { err, ok } from '@/core/result'

const { mockPostStockLedger } = vi.hoisted(() => ({ mockPostStockLedger: vi.fn() }))

vi.mock('@/infrastructure/appwrite/functions', () => ({
  postStockLedger: (...a: unknown[]) => mockPostStockLedger(...a),
}))

import {
  InventoryVoucherType,
  postCountAdjustmentToLedger,
  postTransferToLedger,
  postWriteOffToLedger,
} from '../post-movement'
import type {
  VarianceLine,
  WarehouseTransferRow,
  WriteOffRow,
} from '../../domain/schemas'

const okResult = { voucherNo: 'X', entries: 2, balances: [] }

function transferRow(overrides: Partial<WarehouseTransferRow> = {}): WarehouseTransferRow {
  return {
    $id: 'row-1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'TRF-2026-00001',
    doc_status: 0,
    created_by: 'user-1',
    posting_datetime: '2026-08-30T10:00:00.000Z',
    from_warehouse_id: 'wh-a',
    to_warehouse_id: 'wh-b',
    lines: '[{"product_id":"p1","qty":5,"lot_number":"L-1"}]',
    status: 'executed',
    ...overrides,
  }
}

function writeOffRow(overrides: Partial<WriteOffRow> = {}): WriteOffRow {
  return {
    $id: 'row-2',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'WO-2026-00001',
    doc_status: 1,
    created_by: 'user-1',
    posting_datetime: '2026-08-30T10:00:00.000Z',
    warehouse_id: 'wh-a',
    lines: '[{"product_id":"p1","qty":3}]',
    kind: 'damage',
    reason: 'water damage',
    ...overrides,
  }
}

beforeEach(() => {
  mockPostStockLedger.mockReset()
})

describe('postTransferToLedger', () => {
  it('posts WarehouseTransfer moves under the doc reference id', async () => {
    mockPostStockLedger.mockResolvedValueOnce(ok(okResult))

    const result = await postTransferToLedger(transferRow())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.alreadyPosted).toBe(false)

    const payload = mockPostStockLedger.mock.calls[0]?.[0]
    expect(payload.voucherType).toBe(InventoryVoucherType.WarehouseTransfer)
    expect(payload.voucherNo).toBe('TRF-2026-00001')
    expect(payload.postingDatetime).toBe('2026-08-30T10:00:00.000Z')
    expect(payload.moves).toEqual([
      { productId: 'p1', warehouseId: 'wh-a', lotNumber: 'L-1', qtyChange: -5 },
      { productId: 'p1', warehouseId: 'wh-b', lotNumber: 'L-1', qtyChange: 5 },
    ])
  })

  it('absorbs an already-posted voucher (conflict) as a no-op success', async () => {
    mockPostStockLedger.mockResolvedValueOnce(err(appError('conflict', 'already posted')))

    const result = await postTransferToLedger(transferRow())

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      voucherNo: 'TRF-2026-00001',
      alreadyPosted: true,
      posted: null,
    })
  })

  it('propagates a non-conflict failure', async () => {
    mockPostStockLedger.mockResolvedValueOnce(err(appError('forbidden', 'nope')))
    const result = await postTransferToLedger(transferRow())
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('forbidden')
  })

  it('rejects a transfer whose lines JSON is malformed without calling the Function', async () => {
    const result = await postTransferToLedger(transferRow({ lines: '{not json' }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('validation')
    expect(mockPostStockLedger).not.toHaveBeenCalled()
  })
})

describe('postWriteOffToLedger', () => {
  it('posts WriteOff OUT moves under the doc reference id', async () => {
    mockPostStockLedger.mockResolvedValueOnce(ok(okResult))

    const result = await postWriteOffToLedger(writeOffRow())

    expect(result.ok).toBe(true)
    const payload = mockPostStockLedger.mock.calls[0]?.[0]
    expect(payload.voucherType).toBe(InventoryVoucherType.WriteOff)
    expect(payload.voucherNo).toBe('WO-2026-00001')
    expect(payload.moves).toEqual([
      { productId: 'p1', warehouseId: 'wh-a', lotNumber: null, qtyChange: -3 },
    ])
  })
})

describe('postCountAdjustmentToLedger', () => {
  const variances: VarianceLine[] = [
    { product_id: 'over', recorded_qty: 10, counted_qty: 12, variance: 2 },
    { product_id: 'exact', recorded_qty: 8, counted_qty: 8, variance: 0 },
    { product_id: 'short', recorded_qty: 9, counted_qty: 4, variance: -5 },
  ]

  it('posts StockCountAdjustment deltas for non-zero variances only', async () => {
    mockPostStockLedger.mockResolvedValueOnce(ok(okResult))

    const result = await postCountAdjustmentToLedger(
      {
        reference_id: 'CNT-2026-00001',
        warehouse_id: 'wh-a',
        posting_datetime: '2026-08-30T10:00:00.000Z',
      },
      variances,
    )

    expect(result.ok).toBe(true)
    const payload = mockPostStockLedger.mock.calls[0]?.[0]
    expect(payload.voucherType).toBe(InventoryVoucherType.StockCountAdjustment)
    expect(payload.voucherNo).toBe('CNT-2026-00001')
    expect(payload.moves).toEqual([
      { productId: 'over', warehouseId: 'wh-a', qtyChange: 2 },
      { productId: 'short', warehouseId: 'wh-a', qtyChange: -5 },
    ])
  })

  it('absorbs a re-post (conflict) as alreadyPosted', async () => {
    mockPostStockLedger.mockResolvedValueOnce(err(appError('conflict', 'dup')))
    const result = await postCountAdjustmentToLedger(
      { reference_id: 'CNT-2026-00001', warehouse_id: 'wh-a', posting_datetime: 't' },
      variances,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.alreadyPosted).toBe(true)
  })
})
