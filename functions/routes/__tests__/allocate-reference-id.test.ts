import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { FnError } from '../../common/handler'
import { allocateReferenceId } from '../allocate-reference-id'

const AUG_2026 = new Date('2026-08-15T10:00:00.000Z')
const CALLER = 'user-1'

/** A `users` profile lookup result for `requireStaffCaller`. */
function profile(roles = 'purchasing_accountant') {
  return { total: 1, rows: [{ auth_user_id: CALLER, roles, branch_id: '' }] }
}

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  // Default: caller has a staff profile, so requireStaffCaller passes.
  return { listRows: vi.fn().mockResolvedValue(profile()), ...over } as unknown as TablesDB
}

describe('allocateReferenceId', () => {
  it('rejects an anonymous caller', async () => {
    await expect(
      allocateReferenceId(fakeDb({}), { entity: 'SalesInvoice' }, null, AUG_2026),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('rejects a caller with no staff profile', async () => {
    const listRows = vi.fn().mockResolvedValue({ total: 0, rows: [] })
    await expect(
      allocateReferenceId(fakeDb({ listRows }), { entity: 'SalesInvoice' }, CALLER, AUG_2026),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects an unknown entity before touching the counter', async () => {
    const incrementRowColumn = vi.fn()
    await expect(
      allocateReferenceId(fakeDb({ incrementRowColumn }), { entity: 'Nope' }, CALLER, AUG_2026),
    ).rejects.toBeInstanceOf(FnError)
    expect(incrementRowColumn).not.toHaveBeenCalled()
  })

  it('consumes the sequence before the returned next_value', async () => {
    const incrementRowColumn = vi.fn().mockResolvedValue({ next_value: 43 })
    const out = await allocateReferenceId(
      fakeDb({ incrementRowColumn }),
      { entity: 'SalesInvoice' },
      CALLER,
      AUG_2026,
    )
    expect(out).toEqual({
      referenceId: 'INV-2026-00042',
      prefix: 'INV',
      year: 2026,
      sequence: 42,
    })
    expect(incrementRowColumn).toHaveBeenCalledWith({
      databaseId: 'shield_pro',
      tableId: 'naming_series_counters',
      rowId: 'INV-2026',
      column: 'next_value',
      value: 1,
    })
  })

  it('lazily creates the counter for a year that was never seeded', async () => {
    const notFound = Object.assign(new Error('missing'), { code: 404 })
    const incrementRowColumn = vi.fn().mockRejectedValue(notFound)
    const createRow = vi.fn().mockResolvedValue({})

    const out = await allocateReferenceId(
      fakeDb({ incrementRowColumn, createRow }),
      { entity: 'PurchaseOrder' },
      CALLER,
      new Date('2027-01-02T00:00:00.000Z'),
    )

    expect(out.referenceId).toBe('PO-2027-00001')
    expect(out.sequence).toBe(1)
    expect(createRow).toHaveBeenCalledWith({
      databaseId: 'shield_pro',
      tableId: 'naming_series_counters',
      rowId: 'PO-2027',
      data: { prefix: 'PO', year: 2027, next_value: 2 },
    })
  })

  it('propagates a non-404 database error', async () => {
    const boom = Object.assign(new Error('server on fire'), { code: 500 })
    const incrementRowColumn = vi.fn().mockRejectedValue(boom)
    await expect(
      allocateReferenceId(fakeDb({ incrementRowColumn }), { entity: 'SalesInvoice' }, CALLER, AUG_2026),
    ).rejects.toBe(boom)
  })

  it('recovers when a concurrent call created the new-year counter first', async () => {
    const notFound = Object.assign(new Error('missing'), { code: 404 })
    const conflict = Object.assign(new Error('exists'), { code: 409 })
    // 1st increment: 404 (no counter) → create: 409 (lost the race) → 2nd increment: ok
    const incrementRowColumn = vi
      .fn()
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce({ next_value: 8 })
    const createRow = vi.fn().mockRejectedValue(conflict)

    const out = await allocateReferenceId(
      fakeDb({ incrementRowColumn, createRow }),
      { entity: 'PurchaseOrder' },
      CALLER,
      new Date('2027-01-02T00:00:00.000Z'),
    )

    expect(out.referenceId).toBe('PO-2027-00007')
    expect(out.sequence).toBe(7)
    expect(incrementRowColumn).toHaveBeenCalledTimes(2)
  })
})
