import { describe, expect, it } from 'vitest'

import { buildPortalStatement } from '../statement'

const inv = (id: string, ref: string, date: string, netTotal: number, docStatus = 1) => ({
  id,
  referenceId: ref,
  netTotal,
  postingDatetime: date,
  docStatus,
})
const rec = (id: string, ref: string, date: string, amount: number, docStatus = 1) => ({
  id,
  invoiceRef: ref,
  amount,
  postingDatetime: date,
  docStatus,
})

describe('buildPortalStatement', () => {
  it('runs a chronological balance: invoices debit, receipts credit', () => {
    const s = buildPortalStatement({
      invoices: [
        inv('i1', 'INV-1', '2026-03-01T10:00:00Z', 1000),
        inv('i2', 'INV-2', '2026-03-10T10:00:00Z', 500),
      ],
      receipts: [rec('r1', 'INV-1', '2026-03-05T10:00:00Z', 400)],
    })
    expect(s.rows.map((r) => [r.reference, r.balance])).toEqual([
      ['INV-1', 1000],
      ['INV-1', 600],
      ['INV-2', 1100],
    ])
    expect(s.totalDebit).toBe(1500)
    expect(s.totalCredit).toBe(400)
    expect(s.closingBalance).toBe(1100)
  })

  it('ignores Draft and Cancelled documents', () => {
    const s = buildPortalStatement({
      invoices: [
        inv('i1', 'INV-1', '2026-03-01T10:00:00Z', 1000, 1),
        inv('i2', 'INV-2', '2026-03-02T10:00:00Z', 999, 0),
        inv('i3', 'INV-3', '2026-03-03T10:00:00Z', 888, 2),
      ],
      receipts: [rec('r1', 'INV-1', '2026-03-04T10:00:00Z', 300, 0)],
    })
    expect(s.rows).toHaveLength(1)
    expect(s.closingBalance).toBe(1000)
  })

  it('orders invoice before receipt on the same instant and rounds the balance', () => {
    const s = buildPortalStatement({
      invoices: [inv('i1', 'INV-1', '2026-03-01T00:00:00Z', 0.1 + 0.2)],
      receipts: [rec('r1', 'INV-1', '2026-03-01T00:00:00Z', 0.3)],
    })
    expect(s.rows.map((r) => r.kind)).toEqual(['invoice', 'receipt'])
    expect(s.closingBalance).toBe(0)
  })
})
