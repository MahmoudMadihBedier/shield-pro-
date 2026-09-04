import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { FnError } from '../../common/handler'
import { submitDocument } from '../submit-document'

const NOW = new Date('2026-09-01T12:00:00.000Z')

/** A `users` profile lookup result for `loadCallerContext`. */
function profile(roles = 'sales_rep', branchId: string | null = null) {
  return { total: 1, rows: [{ auth_user_id: 'auth', roles, branch_id: branchId ?? '' }] }
}

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  // Default: caller has an allowed role for `sales_invoices` and no branch pin.
  return { listRows: vi.fn().mockResolvedValue(profile()), ...over } as unknown as TablesDB
}

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'row-1',
    reference_id: 'INV-2026-00042',
    doc_status: 0,
    created_by: 'user-1',
    posting_datetime: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('submitDocument', () => {
  it('rejects a table that is not a submittable document', async () => {
    await expect(
      submitDocument(fakeDb({}), { table: 'branches', rowId: 'x' }, 'user-1', NOW),
    ).rejects.toBeInstanceOf(FnError)
  })

  it('requires a rowId', async () => {
    await expect(
      submitDocument(fakeDb({}), { table: 'sales_invoices', rowId: '' }, 'user-1', NOW),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('rejects an anonymous caller', async () => {
    await expect(
      submitDocument(fakeDb({}), { table: 'sales_invoices', rowId: 'row-1' }, null, NOW),
    ).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('maps a missing row to not_found', async () => {
    const getRow = vi.fn().mockRejectedValue(Object.assign(new Error('nope'), { code: 404 }))
    await expect(
      submitDocument(
        fakeDb({ getRow }),
        { table: 'sales_invoices', rowId: 'row-1' },
        'user-1',
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'not_found' })
  })

  it('refuses to submit a row that is already submitted', async () => {
    const getRow = vi.fn().mockResolvedValue(draftRow({ doc_status: 1 }))
    const updateRow = vi.fn()
    await expect(
      submitDocument(
        fakeDb({ getRow, updateRow }),
        { table: 'sales_invoices', rowId: 'row-1' },
        'user-1',
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(updateRow).not.toHaveBeenCalled()
  })

  it('refuses to submit a cancelled row', async () => {
    const getRow = vi.fn().mockResolvedValue(draftRow({ doc_status: 2 }))
    await expect(
      submitDocument(
        fakeDb({ getRow }),
        { table: 'sales_invoices', rowId: 'row-1' },
        'user-1',
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'conflict' })
  })

  it('rejects a caller whose role may not submit this document type', async () => {
    const getRow = vi.fn().mockResolvedValue(draftRow())
    const listRows = vi.fn().mockResolvedValue(profile('raw_store_keeper'))
    await expect(
      submitDocument(
        fakeDb({ getRow, listRows }),
        { table: 'sales_invoices', rowId: 'row-1' },
        'user-1',
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects a caller bound to a different branch', async () => {
    const getRow = vi.fn().mockResolvedValue(draftRow({ branch_id: 'giza' }))
    const listRows = vi.fn().mockResolvedValue(profile('sales_rep', 'cairo'))
    await expect(
      submitDocument(
        fakeDb({ getRow, listRows }),
        { table: 'sales_invoices', rowId: 'row-1' },
        'user-1',
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects a row that violates segregation of duties (requested_by === approved_by)', async () => {
    const getRow = vi
      .fn()
      .mockResolvedValue(draftRow({ requested_by: 'user-1', approved_by: 'user-1' }))
    await expect(
      submitDocument(
        fakeDb({ getRow }),
        { table: 'sales_invoices', rowId: 'row-1' },
        'user-1',
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('rejects a caller with no profile row and a non-global role', async () => {
    const getRow = vi.fn().mockResolvedValue(draftRow())
    const listRows = vi.fn().mockResolvedValue({ total: 0, rows: [] })
    await expect(
      submitDocument(
        fakeDb({ getRow, listRows }),
        { table: 'sales_invoices', rowId: 'row-1' },
        'user-1',
        NOW,
      ),
    ).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('flips a draft to submitted, stamps the posting time, and writes an audit row', async () => {
    const getRow = vi.fn().mockResolvedValue(draftRow())
    const updateRow = vi.fn().mockResolvedValue({})
    const createRow = vi.fn().mockResolvedValue({})
    const listRows = vi.fn().mockResolvedValue(profile('system_admin'))

    const out = await submitDocument(
      fakeDb({ getRow, updateRow, createRow, listRows }),
      { table: 'sales_invoices', rowId: 'row-1' },
      'user-7',
      NOW,
    )

    expect(out).toEqual({
      table: 'sales_invoices',
      rowId: 'row-1',
      referenceId: 'INV-2026-00042',
      docStatus: 1,
      postingDatetime: NOW.toISOString(),
    })
    expect(updateRow).toHaveBeenCalledWith({
      databaseId: 'shield_pro',
      tableId: 'sales_invoices',
      rowId: 'row-1',
      data: { doc_status: 1, posting_datetime: NOW.toISOString() },
      permissions: ['read("users")'],
    })
    expect(createRow).toHaveBeenCalledTimes(1)
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'audit_log',
        data: expect.objectContaining({
          actor_id: 'user-7',
          action: 'submit',
          entity_type: 'sales_invoices',
          entity_ref: 'INV-2026-00042',
        }),
      }),
    )
  })
})
