import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { CREDIT, DEBIT } from '@/core/ledger'

import { FnError } from '../../common/handler'
import { postGl } from '../post-gl'

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  return over as unknown as TablesDB
}

const balanced = [DEBIT('1200-inventory', 100), CREDIT('2100-payables', 100)]

const baseInput = {
  voucherType: 'StockReceipt',
  voucherNo: 'GLE-2026-00003',
  postingDatetime: '2026-09-01T09:00:00.000Z',
  branchId: 'branch-1',
  lines: balanced,
}

describe('postGl', () => {
  it('requires at least one line', async () => {
    await expect(
      postGl(fakeDb({}), { ...baseInput, lines: [] }, 'user-1'),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('rejects an unbalanced posting as a validation error', async () => {
    const listRows = vi.fn()
    const createRow = vi.fn()
    await expect(
      postGl(
        fakeDb({ listRows, createRow }),
        { ...baseInput, lines: [DEBIT('1200', 100), CREDIT('4000', 90)] },
        'user-1',
      ),
    ).rejects.toMatchObject({ code: 'validation' })
    expect(listRows).not.toHaveBeenCalled()
    expect(createRow).not.toHaveBeenCalled()
  })

  it('refuses to re-post a voucher that already has GL entries', async () => {
    const listRows = vi.fn().mockResolvedValue({ total: 2, rows: [{ $id: 'gle-old' }] })
    const createRow = vi.fn()
    await expect(
      postGl(fakeDb({ listRows, createRow }), baseInput, 'user-1'),
    ).rejects.toBeInstanceOf(FnError)
    await expect(
      postGl(fakeDb({ listRows, createRow }), baseInput, 'user-1'),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(createRow).not.toHaveBeenCalled()
  })

  it('writes one row per line plus an audit row', async () => {
    const listRows = vi.fn().mockResolvedValue({ total: 0, rows: [] })
    const createRow = vi.fn().mockResolvedValue({})

    const out = await postGl(fakeDb({ listRows, createRow }), baseInput, 'user-7')

    expect(out).toEqual({ voucherNo: 'GLE-2026-00003', entries: 2 })
    expect(createRow).toHaveBeenCalledTimes(3) // 2 GL lines + 1 audit
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'general_ledger_entries',
        data: expect.objectContaining({
          voucher_type: 'StockReceipt',
          voucher_no: 'GLE-2026-00003',
          account: '1200-inventory',
          branch_id: 'branch-1',
          debit: 100,
          credit: 0,
          posting_datetime: '2026-09-01T09:00:00.000Z',
          is_cancelled: false,
        }),
      }),
    )
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'general_ledger_entries',
        data: expect.objectContaining({ account: '2100-payables', debit: 0, credit: 100 }),
      }),
    )
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'audit_log',
        data: expect.objectContaining({
          actor_id: 'user-7',
          action: 'post_gl',
          entity_type: 'general_ledger_entries',
          entity_ref: 'GLE-2026-00003',
        }),
      }),
    )
  })
})
