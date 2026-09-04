import { describe, expect, it } from 'vitest'

import { Tables } from '@/infrastructure/appwrite/collections'

import { DocStatus } from '../doc-status'
import {
  SUBMITTABLE_DOC_TABLES,
  documentEnvelopeSchema,
  isSubmittableDocTable,
} from '../document'

describe('SUBMITTABLE_DOC_TABLES', () => {
  it('every id is a real table in the Appwrite collection registry', () => {
    const known = new Set<string>(Object.values(Tables))
    for (const table of SUBMITTABLE_DOC_TABLES) {
      expect(known.has(table), `${table} missing from Tables`).toBe(true)
    }
  })

  it('matches exactly the set of submittable document tables', () => {
    // The submittable docs are every movement/transaction table between
    // `purchaseOrders` and `payrollRuns` in the registry.
    const expected = [
      Tables.purchaseOrders,
      Tables.stockReceipts,
      Tables.productionRequests,
      Tables.productionBatches,
      Tables.warehouseTransfers,
      Tables.repStockIssues,
      Tables.salesInvoices,
      Tables.receipts,
      Tables.paymentVouchers,
      Tables.returnRequests,
      Tables.writeOffs,
      Tables.stockCountSessions,
      Tables.repCloseouts,
      Tables.payrollRuns,
    ].sort()
    expect([...SUBMITTABLE_DOC_TABLES].sort()).toEqual(expected)
  })

  it('isSubmittableDocTable narrows known ids and rejects others', () => {
    expect(isSubmittableDocTable('sales_invoices')).toBe(true)
    expect(isSubmittableDocTable('branches')).toBe(false)
    expect(isSubmittableDocTable('stock_ledger_entries')).toBe(false)
    expect(isSubmittableDocTable('')).toBe(false)
  })
})

describe('documentEnvelopeSchema', () => {
  const valid = {
    reference_id: 'INV-2026-00042',
    doc_status: DocStatus.Draft,
    branch_id: 'branch-1',
    created_by: 'user-1',
    amended_from: null,
    posting_datetime: '2026-09-01T00:00:00.000Z',
    remarks: null,
  }

  it('accepts a well-formed draft envelope', () => {
    const parsed = documentEnvelopeSchema.parse(valid)
    expect(parsed.doc_status).toBe(DocStatus.Draft)
  })

  it('rejects an out-of-range doc_status', () => {
    const res = documentEnvelopeSchema.safeParse({ ...valid, doc_status: 5 })
    expect(res.success).toBe(false)
  })

  it('rejects a missing created_by', () => {
    const { created_by: _omit, ...rest } = valid
    expect(documentEnvelopeSchema.safeParse(rest).success).toBe(false)
  })

  it('tolerates optional branch_id / remarks being absent', () => {
    const { branch_id: _b, remarks: _r, amended_from: _a, ...rest } = valid
    expect(documentEnvelopeSchema.safeParse(rest).success).toBe(true)
  })
})
