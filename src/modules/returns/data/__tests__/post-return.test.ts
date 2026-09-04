import { beforeEach, describe, expect, it, vi } from 'vitest'

import { appError } from '@/core/errors'
import { err, ok } from '@/core/result'

const { mockPostStockLedger } = vi.hoisted(() => ({ mockPostStockLedger: vi.fn() }))

vi.mock('@/infrastructure/appwrite/functions', () => ({
  postStockLedger: (...a: unknown[]) => mockPostStockLedger(...a),
}))

import { postReturnToLedger, ReturnsVoucherType } from '../post-return'
import type { ReturnRequestRow } from '../../domain/schemas'

const okResult = { voucherNo: 'X', entries: 2, balances: [] }

function returnRow(overrides: Partial<ReturnRequestRow> = {}): ReturnRequestRow {
  return {
    $id: 'row-1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'RET-2026-00001',
    doc_status: 1,
    created_by: 'user-1',
    posting_datetime: '2026-08-30T10:00:00.000Z',
    origin_ref: 'INV-2026-00042',
    lines: '[{"product_id":"p1","qty":4}]',
    reason: 'customer changed mind',
    status: 'approved',
    ...overrides,
  }
}

beforeEach(() => {
  mockPostStockLedger.mockReset()
})

describe('postReturnToLedger', () => {
  it('posts ReturnRequest IN moves into the chosen warehouse under the doc reference id', async () => {
    mockPostStockLedger.mockResolvedValueOnce(ok(okResult))

    const result = await postReturnToLedger(returnRow(), 'wh-main')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.alreadyPosted).toBe(false)

    const payload = mockPostStockLedger.mock.calls[0]?.[0]
    expect(payload.voucherType).toBe(ReturnsVoucherType.ReturnRequest)
    expect(payload.voucherNo).toBe('RET-2026-00001')
    expect(payload.postingDatetime).toBe('2026-08-30T10:00:00.000Z')
    expect(payload.moves).toEqual([{ productId: 'p1', warehouseId: 'wh-main', qtyChange: 4 }])
  })

  it('every posted move has a positive qtyChange', async () => {
    mockPostStockLedger.mockResolvedValueOnce(ok(okResult))
    await postReturnToLedger(
      returnRow({ lines: '[{"product_id":"p1","qty":2},{"product_id":"p2","qty":7}]' }),
      'wh-main',
    )
    const payload = mockPostStockLedger.mock.calls[0]?.[0]
    for (const move of payload.moves) {
      expect(move.qtyChange).toBeGreaterThan(0)
    }
  })

  it('absorbs an already-posted voucher (conflict) as a no-op success', async () => {
    mockPostStockLedger.mockResolvedValueOnce(err(appError('conflict', 'already posted')))

    const result = await postReturnToLedger(returnRow(), 'wh-main')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      voucherNo: 'RET-2026-00001',
      alreadyPosted: true,
      posted: null,
    })
  })

  it('propagates a non-conflict failure', async () => {
    mockPostStockLedger.mockResolvedValueOnce(err(appError('forbidden', 'nope')))
    const result = await postReturnToLedger(returnRow(), 'wh-main')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('forbidden')
  })

  it('rejects a return whose lines JSON is malformed without calling the Function', async () => {
    const result = await postReturnToLedger(returnRow({ lines: '{not json' }), 'wh-main')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('validation')
    expect(mockPostStockLedger).not.toHaveBeenCalled()
  })
})
