import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { segregationGuard } from '../segregation-guard'

const CALLER = 'u1'
/** A `users` profile lookup result for `requireStaffCaller` — always call #1. */
const STAFF_PROFILE = { total: 1, rows: [{ auth_user_id: CALLER, roles: 'system_admin', branch_id: '' }] }

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  return { listRows: vi.fn().mockResolvedValue(STAFF_PROFILE), ...over } as unknown as TablesDB
}

describe('segregationGuard', () => {
  it('rejects an anonymous caller', async () => {
    await expect(
      segregationGuard(fakeDb({}), { table: 'sales_invoices', rowId: 'r' }, null),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('rejects a caller with no staff profile', async () => {
    const listRows = vi.fn().mockResolvedValue({ total: 0, rows: [] })
    await expect(
      segregationGuard(fakeDb({ listRows }), { table: 'sales_invoices', rowId: 'r' }, CALLER),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects a table that is not a submittable document', async () => {
    await expect(
      segregationGuard(fakeDb({}), { table: 'branches', rowId: 'r' }, CALLER),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('maps a missing row to not_found', async () => {
    const getRow = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { code: 404 }))
    await expect(
      segregationGuard(fakeDb({ getRow }), { table: 'sales_invoices', rowId: 'r' }, CALLER),
    ).rejects.toMatchObject({ code: 'not_found' })
  })

  it('reports a clean row', async () => {
    const getRow = vi.fn().mockResolvedValue({ sold_by: 'rep', cashup_confirmed_by: 'cashier' })
    const out = await segregationGuard(
      fakeDb({ getRow }),
      { table: 'sales_invoices', rowId: 'r' },
      CALLER,
    )
    expect(out).toEqual({ violated: [], clean: true })
  })

  it('reports the violated rule ids for a self-approval row', async () => {
    const getRow = vi.fn().mockResolvedValue({ sold_by: 'x', cashup_confirmed_by: 'x' })
    const out = await segregationGuard(
      fakeDb({ getRow }),
      { table: 'sales_invoices', rowId: 'r' },
      CALLER,
    )
    expect(out).toEqual({ violated: ['sold-vs-cashup'], clean: false })
  })
})
