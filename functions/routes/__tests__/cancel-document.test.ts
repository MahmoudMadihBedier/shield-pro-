import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { FnError } from '../../common/handler'
import { cancelDocument } from '../cancel-document'

/** A `users` profile lookup result for `loadCallerContext`. */
function profile(roles = 'branch_accountant', branchId: string | null = null) {
  return { total: 1, rows: [{ auth_user_id: 'auth', roles, branch_id: branchId ?? '' }] }
}

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  return { listRows: vi.fn().mockResolvedValue(profile()), ...over } as unknown as TablesDB
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'row-1',
    reference_id: 'INV-2026-00042',
    doc_status: 1,
    created_by: 'user-1',
    posting_datetime: '2026-09-01T00:00:00.000Z',
    remarks: null,
    ...overrides,
  }
}

describe('cancelDocument', () => {
  it('rejects an anonymous caller', async () => {
    await expect(
      cancelDocument(fakeDb({}), { table: 'sales_invoices', rowId: 'r', reason: 'x' }, null),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('requires a reason', async () => {
    const getRow = vi.fn().mockResolvedValue(row())
    await expect(
      cancelDocument(
        fakeDb({ getRow }),
        { table: 'sales_invoices', rowId: 'row-1', reason: '  ' },
        'u1',
      ),
    ).rejects.toMatchObject({ code: 'validation' })
    expect(getRow).not.toHaveBeenCalled()
  })

  it('will not cancel a draft', async () => {
    const getRow = vi.fn().mockResolvedValue(row({ doc_status: 0 }))
    const updateRow = vi.fn()
    await expect(
      cancelDocument(
        fakeDb({ getRow, updateRow }),
        { table: 'sales_invoices', rowId: 'row-1', reason: 'oops' },
        'u1',
      ),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(updateRow).not.toHaveBeenCalled()
  })

  it('will not cancel an already-cancelled document', async () => {
    const getRow = vi.fn().mockResolvedValue(row({ doc_status: 2 }))
    await expect(
      cancelDocument(
        fakeDb({ getRow }),
        { table: 'sales_invoices', rowId: 'row-1', reason: 'again' },
        'u1',
      ),
    ).rejects.toBeInstanceOf(FnError)
  })

  it('rejects a caller whose role may not cancel this document type', async () => {
    const getRow = vi.fn().mockResolvedValue(row())
    const listRows = vi.fn().mockResolvedValue(profile('raw_store_keeper'))
    await expect(
      cancelDocument(
        fakeDb({ getRow, listRows }),
        { table: 'sales_invoices', rowId: 'row-1', reason: 'x' },
        'u1',
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects a caller bound to a different branch', async () => {
    const getRow = vi.fn().mockResolvedValue(row({ branch_id: 'giza' }))
    const listRows = vi.fn().mockResolvedValue(profile('branch_accountant', 'cairo'))
    await expect(
      cancelDocument(
        fakeDb({ getRow, listRows }),
        { table: 'sales_invoices', rowId: 'row-1', reason: 'x' },
        'u1',
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects a row that violates segregation of duties', async () => {
    const getRow = vi.fn().mockResolvedValue(row({ requested_by: 'user-1', approved_by: 'user-1' }))
    await expect(
      cancelDocument(
        fakeDb({ getRow }),
        { table: 'sales_invoices', rowId: 'row-1', reason: 'x' },
        'u1',
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects a caller with no profile row and a non-global role', async () => {
    const getRow = vi.fn().mockResolvedValue(row())
    const listRows = vi.fn().mockResolvedValue({ total: 0, rows: [] })
    await expect(
      cancelDocument(
        fakeDb({ getRow, listRows }),
        { table: 'sales_invoices', rowId: 'row-1', reason: 'x' },
        'u1',
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('cancels a submitted document, appends the reason to remarks, and audits it', async () => {
    const getRow = vi.fn().mockResolvedValue(row({ remarks: 'original note' }))
    const updateRow = vi.fn().mockResolvedValue({})
    const createRow = vi.fn().mockResolvedValue({})
    const listRows = vi.fn().mockResolvedValue(profile('system_admin'))

    const out = await cancelDocument(
      fakeDb({ getRow, updateRow, createRow, listRows }),
      { table: 'sales_invoices', rowId: 'row-1', reason: 'duplicate of INV-2026-00041' },
      'user-9',
    )

    expect(out).toEqual({
      table: 'sales_invoices',
      rowId: 'row-1',
      referenceId: 'INV-2026-00042',
      docStatus: 2,
    })
    expect(updateRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'sales_invoices',
        rowId: 'row-1',
        data: {
          doc_status: 2,
          remarks: 'Cancelled by user-9: duplicate of INV-2026-00041\noriginal note',
        },
      }),
    )
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'audit_log',
        data: expect.objectContaining({
          action: 'cancel',
          actor_id: 'user-9',
          entity_ref: 'INV-2026-00042',
        }),
      }),
    )
  })
})
