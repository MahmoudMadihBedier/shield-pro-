import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { ok, err } from '@/core/result'
import { appError } from '@/core/errors'

const listRows = vi.fn()
const getRow = vi.fn()
const createRow = vi.fn()
const updateRow = vi.fn()
const allocateReferenceId = vi.fn()
const submitDocument = vi.fn()
const cancelDocument = vi.fn()
const evaluateApproval = vi.fn()

vi.mock('@/infrastructure/appwrite/services', () => ({
  tablesDB: {
    listRows: (...a: unknown[]) => listRows(...a),
    getRow: (...a: unknown[]) => getRow(...a),
    createRow: (...a: unknown[]) => createRow(...a),
    updateRow: (...a: unknown[]) => updateRow(...a),
  },
  ID: { unique: () => 'generated-id' },
  Query: {
    limit: (n: number) => `limit(${n})`,
    offset: (n: number) => `offset(${n})`,
    equal: (k: string, v: unknown) => `equal(${k},${String(v)})`,
    startsWith: (k: string, v: string) => `startsWith(${k},${v})`,
    orderAsc: (k: string) => `asc(${k})`,
    orderDesc: (k: string) => `desc(${k})`,
  },
}))
vi.mock('@/infrastructure/appwrite/collections', () => ({ DATABASE_ID: 'shield_pro' }))
vi.mock('@/infrastructure/appwrite/errors', () => ({
  mapAppwriteError: (e: unknown) => appError('server', 'mapped', { cause: e }),
}))
vi.mock('@/infrastructure/appwrite/functions', () => ({
  allocateReferenceId: (...a: unknown[]) => allocateReferenceId(...a),
  submitDocument: (...a: unknown[]) => submitDocument(...a),
  cancelDocument: (...a: unknown[]) => cancelDocument(...a),
  evaluateApproval: (...a: unknown[]) => evaluateApproval(...a),
}))

const { makeDocumentRepo } = await import('../document-repo')

const poRowSchema = z.object({
  $id: z.string(),
  reference_id: z.string(),
  doc_status: z.number(),
  created_by: z.string(),
  supplier_id: z.string(),
})
type PoRow = z.infer<typeof poRowSchema>
type PoDraft = { supplier_id: string; lines: string }

function repo() {
  return makeDocumentRepo<PoRow, PoDraft>({ entity: 'PurchaseOrder', rowSchema: poRowSchema })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('makeDocumentRepo', () => {
  it('maps the entity to its table', () => {
    expect(repo().table).toBe('purchase_orders')
    expect(repo().entity).toBe('PurchaseOrder')
  })

  describe('createDraft', () => {
    it('allocates a reference id, writes the envelope + fields, and parses the row', async () => {
      allocateReferenceId.mockResolvedValue(
        ok({ referenceId: 'PO-2026-00007', prefix: 'PO', year: 2026, sequence: 7 }),
      )
      createRow.mockResolvedValue({
        $id: 'row-1',
        reference_id: 'PO-2026-00007',
        doc_status: 0,
        created_by: 'user-1',
        supplier_id: 'sup-1',
      })

      const res = await repo().createDraft(
        { supplier_id: 'sup-1', lines: '[]' },
        { userId: 'user-1', branchId: 'branch-9' },
      )

      expect(allocateReferenceId).toHaveBeenCalledWith('PurchaseOrder')
      expect(res.ok).toBe(true)
      const createArg = createRow.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
      expect(createArg?.data).toMatchObject({
        supplier_id: 'sup-1',
        lines: '[]',
        reference_id: 'PO-2026-00007',
        doc_status: 0,
        created_by: 'user-1',
        branch_id: 'branch-9',
      })
    })

    it('propagates an allocation failure without writing a row', async () => {
      allocateReferenceId.mockResolvedValue(err(appError('server', 'counter down')))
      const res = await repo().createDraft({ supplier_id: 's', lines: '[]' }, { userId: 'u' })
      expect(res.ok).toBe(false)
      expect(createRow).not.toHaveBeenCalled()
    })

    it('maps a write failure to an AppError', async () => {
      allocateReferenceId.mockResolvedValue(
        ok({ referenceId: 'PO-2026-00008', prefix: 'PO', year: 2026, sequence: 8 }),
      )
      createRow.mockRejectedValue(new Error('boom'))
      const res = await repo().createDraft({ supplier_id: 's', lines: '[]' }, { userId: 'u' })
      expect(res).toEqual(err(appError('server', 'mapped', { cause: expect.any(Error) })))
    })
  })

  describe('list', () => {
    it('builds paged, filtered, sorted queries and parses every row', async () => {
      listRows.mockResolvedValue({
        total: 1,
        rows: [
          {
            $id: 'r1',
            reference_id: 'PO-2026-00001',
            doc_status: 1,
            created_by: 'u',
            supplier_id: 's',
          },
        ],
      })
      const res = await repo().list({ docStatus: 1, branchId: 'b1', search: 'PO-2026', page: 2, pageSize: 10 })
      expect(res.ok).toBe(true)
      const call = listRows.mock.calls[0]?.[0] as { queries: string[] } | undefined
      const queries = call?.queries ?? []
      expect(queries).toEqual(
        expect.arrayContaining([
          'limit(10)',
          'offset(20)',
          'equal(doc_status,1)',
          'equal(branch_id,b1)',
          'startsWith(reference_id,PO-2026)',
          'desc($createdAt)',
        ]),
      )
    })

    it('fails fast if a row does not match the schema', async () => {
      listRows.mockResolvedValue({ total: 1, rows: [{ $id: 'r1' }] })
      const res = await repo().list()
      expect(res.ok).toBe(false)
    })
  })

  describe('submit / cancel', () => {
    const draftRow = {
      $id: 'row-1',
      reference_id: 'PO-2026-1',
      doc_status: 0,
      created_by: 'u',
      supplier_id: 's',
    }

    it('runs the approval engine, then delegates to submit-document on auto_approve', async () => {
      getRow.mockResolvedValue(draftRow)
      evaluateApproval.mockResolvedValue(
        ok({ action: 'auto_approve', ruleId: null, approvalRequestId: 'req-1' }),
      )
      submitDocument.mockResolvedValue(ok({ referenceId: 'PO-2026-1', docStatus: 1 }))

      const res = await repo().submit('row-1')

      expect(evaluateApproval).toHaveBeenCalledWith({
        movementType: 'purchase_orders',
        entityRef: 'PO-2026-1',
        context: {},
      })
      expect(submitDocument).toHaveBeenCalledWith('purchase_orders', 'row-1')
      expect(res.ok).toBe(true)
    })

    it('forwards the row total to the approval context', async () => {
      getRow.mockResolvedValue({ ...draftRow, net_total: 1250 })
      evaluateApproval.mockResolvedValue(
        ok({ action: 'auto_approve', ruleId: null, approvalRequestId: 'req-1' }),
      )
      submitDocument.mockResolvedValue(ok({ referenceId: 'PO-2026-1', docStatus: 1 }))

      await repo().submit('row-1')

      expect(evaluateApproval).toHaveBeenCalledWith(
        expect.objectContaining({ context: { amount: 1250 } }),
      )
    })

    it('returns a pending_approval error and does NOT submit on force_manual', async () => {
      getRow.mockResolvedValue(draftRow)
      evaluateApproval.mockResolvedValue(
        ok({ action: 'force_manual', ruleId: 'rule-9', approvalRequestId: 'req-7' }),
      )

      const res = await repo().submit('row-1')

      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.error.code).toBe('pending_approval')
      expect(submitDocument).not.toHaveBeenCalled()
    })

    it('propagates an approval-engine failure without submitting', async () => {
      getRow.mockResolvedValue(draftRow)
      evaluateApproval.mockResolvedValue(err(appError('server', 'engine down')))

      const res = await repo().submit('row-1')

      expect(res.ok).toBe(false)
      expect(submitDocument).not.toHaveBeenCalled()
    })

    it('delegates cancel to the cancel-document route with the table id', async () => {
      cancelDocument.mockResolvedValue(ok({ referenceId: 'PO-2026-1', docStatus: 2 }))
      await repo().cancel('row-1', 'duplicate')
      expect(cancelDocument).toHaveBeenCalledWith('purchase_orders', 'row-1', 'duplicate')
    })
  })
})
