import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { FnError } from '../../common/handler'
import { postStockLedger } from '../post-stock-ledger'

const NOW = new Date('2026-09-01T12:00:00.000Z')
const CALLER = 'user-7'

/** A `users` profile lookup result for `requireStaffCaller` — always call #1. */
const STAFF_PROFILE = { total: 1, rows: [{ auth_user_id: CALLER, roles: 'main_warehouse_manager', branch_id: '' }] }

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  return { listRows: vi.fn().mockResolvedValue(STAFF_PROFILE), ...over } as unknown as TablesDB
}

const baseInput = {
  voucherType: 'StockReceipt',
  voucherNo: 'SR-2026-00007',
  postingDatetime: '2026-09-01T09:00:00.000Z',
  moves: [{ productId: 'prod-1', warehouseId: 'wh-1', qtyChange: 5, valuationRate: 2 }],
}

describe('postStockLedger', () => {
  it('rejects an anonymous caller', async () => {
    await expect(
      postStockLedger(fakeDb({}), baseInput, null, NOW),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('rejects a caller with no staff profile', async () => {
    const listRows = vi.fn().mockResolvedValue({ total: 0, rows: [] })
    await expect(
      postStockLedger(fakeDb({ listRows }), baseInput, CALLER, NOW),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('requires at least one move', async () => {
    await expect(
      postStockLedger(fakeDb({}), { ...baseInput, moves: [] }, CALLER, NOW),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('refuses to re-post a voucher that already has ledger entries', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(STAFF_PROFILE) // requireStaffCaller
      .mockResolvedValueOnce({ total: 1, rows: [{ $id: 'sle-old' }] }) // voucher dedup
    const createRow = vi.fn()
    await expect(
      postStockLedger(fakeDb({ listRows, createRow }), baseInput, CALLER, NOW),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(createRow).not.toHaveBeenCalled()
  })

  it('blocks a move that would drive the bin negative', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(STAFF_PROFILE) // requireStaffCaller
      .mockResolvedValueOnce({ total: 0, rows: [] }) // voucher dedup
      .mockResolvedValueOnce({ total: 1, rows: [{ $id: 'bin-1', qty: 3 }] }) // current bin
    const createRow = vi.fn()
    await expect(
      postStockLedger(
        fakeDb({ listRows, createRow }),
        { ...baseInput, moves: [{ productId: 'prod-1', warehouseId: 'wh-1', qtyChange: -10 }] },
        CALLER,
        NOW,
      ),
    ).rejects.toBeInstanceOf(FnError)
    expect(createRow).not.toHaveBeenCalled()
  })

  it('appends an SLE row, creates the missing bin, and writes an audit row', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(STAFF_PROFILE) // requireStaffCaller
      .mockResolvedValueOnce({ total: 0, rows: [] }) // voucher dedup
      .mockResolvedValueOnce({ total: 0, rows: [] }) // no bin yet
    const createRow = vi.fn().mockResolvedValue({})
    const updateRow = vi.fn().mockResolvedValue({})

    const out = await postStockLedger(
      fakeDb({ listRows, createRow, updateRow }),
      baseInput,
      CALLER,
      NOW,
    )

    expect(out).toEqual({
      voucherNo: 'SR-2026-00007',
      entries: 1,
      balances: [{ productId: 'prod-1', warehouseId: 'wh-1', qtyAfter: 5 }],
    })
    expect(updateRow).not.toHaveBeenCalled()
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'stock_ledger_entries',
        data: expect.objectContaining({
          voucher_type: 'StockReceipt',
          voucher_no: 'SR-2026-00007',
          product_id: 'prod-1',
          warehouse_id: 'wh-1',
          lot_number: null,
          qty_change: 5,
          qty_after: 5,
          valuation_rate: 2,
          posting_datetime: '2026-09-01T09:00:00.000Z',
          is_cancelled: false,
        }),
      }),
    )
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'bin_balances',
        data: expect.objectContaining({
          product_id: 'prod-1',
          warehouse_id: 'wh-1',
          qty: 5,
          updated_datetime: NOW.toISOString(),
        }),
      }),
    )
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'audit_log',
        data: expect.objectContaining({
          actor_id: CALLER,
          action: 'post_stock_ledger',
          entity_type: 'stock_ledger_entries',
          entity_ref: 'SR-2026-00007',
        }),
      }),
    )
  })

  it('upserts an existing bin to the new running quantity', async () => {
    const listRows = vi
      .fn()
      .mockResolvedValueOnce(STAFF_PROFILE) // requireStaffCaller
      .mockResolvedValueOnce({ total: 0, rows: [] }) // voucher dedup
      .mockResolvedValueOnce({ total: 1, rows: [{ $id: 'bin-9', qty: 10 }] }) // current bin
    const createRow = vi.fn().mockResolvedValue({})
    const updateRow = vi.fn().mockResolvedValue({})

    const out = await postStockLedger(
      fakeDb({ listRows, createRow, updateRow }),
      baseInput,
      CALLER,
      NOW,
    )

    expect(out.balances).toEqual([{ productId: 'prod-1', warehouseId: 'wh-1', qtyAfter: 15 }])
    expect(updateRow).toHaveBeenCalledWith({
      databaseId: 'shield_pro',
      tableId: 'bin_balances',
      rowId: 'bin-9',
      data: { qty: 15, updated_datetime: NOW.toISOString() },
    })
  })
})
