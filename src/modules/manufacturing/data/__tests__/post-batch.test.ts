import { beforeEach, describe, expect, it, vi } from 'vitest'

import { appError } from '@/core/errors'
import { err, ok } from '@/core/result'

const postStockLedger = vi.fn()

vi.mock('@/infrastructure/appwrite/functions', () => ({
  postStockLedger: (...a: unknown[]) => postStockLedger(...a),
}))

const { postBatchToLedger, isAlreadyPosted } = await import('../post-batch')
const { productionBatchRowSchema } = await import('../../domain/schemas')

const batch = productionBatchRowSchema.parse({
  $id: 'row-1',
  $createdAt: '2026-01-01T00:00:00.000Z',
  $updatedAt: '2026-01-01T00:00:00.000Z',
  reference_id: 'BATCH-2026-00007',
  doc_status: 1,
  branch_id: null,
  created_by: 'user-1',
  amended_from: null,
  posting_datetime: '2026-02-01T09:00:00.000Z',
  remarks: null,
  production_request_ref: 'PR-2026-00003',
  product_id: 'prod-1',
  lot_number: 'LOT-A',
  produced_qty: 100,
  waste_qty: 5,
  raw_material_lots: JSON.stringify([{ purchase_order_ref: 'PO-1', qty_consumed: 20 }]),
  expected_cost: 400,
  expected_profit: 600,
  qc_status: 'released',
  qc_by: 'qc-1',
  expiry_date: '2027-01-01',
})

const warehouses = {
  factoryCustodyWarehouseId: 'wh-factory',
  rawStoreWarehouseId: 'wh-raw',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('postBatchToLedger', () => {
  it('calls /post-stock-ledger with the batch reference id as voucher_no and the derived moves', async () => {
    postStockLedger.mockResolvedValue(ok({ voucherNo: 'BATCH-2026-00007', entries: 2, balances: [] }))

    const res = await postBatchToLedger(batch, warehouses)

    expect(res.ok).toBe(true)
    expect(postStockLedger).toHaveBeenCalledWith({
      voucherType: 'ProductionBatch',
      voucherNo: 'BATCH-2026-00007',
      postingDatetime: '2026-02-01T09:00:00.000Z',
      moves: [
        { productId: 'PO-1', warehouseId: 'wh-raw', qtyChange: -20 },
        {
          productId: 'prod-1',
          warehouseId: 'wh-factory',
          lotNumber: 'LOT-A',
          qtyChange: 100,
          valuationRate: 4,
        },
      ],
    })
  })

  it('surfaces a malformed raw_material_lots column as a validation error without calling the server', async () => {
    const res = await postBatchToLedger({ ...batch, raw_material_lots: 'not json' }, warehouses)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('validation')
    expect(postStockLedger).not.toHaveBeenCalled()
  })

  it('passes a re-post conflict straight through, flagged by isAlreadyPosted', async () => {
    postStockLedger.mockResolvedValue(err(appError('conflict', 'voucher already posted')))
    const res = await postBatchToLedger(batch, warehouses)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(isAlreadyPosted(res.error)).toBe(true)
  })
})
