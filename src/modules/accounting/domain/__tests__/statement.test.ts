import { describe, expect, it } from 'vitest'

import { buildCustomerStatement, customerStatementToRows } from '../statement'

const inv = (reference: string, date: string, receivable: number) => ({
  reference,
  date,
  receivable,
})
const cr = (reference: string, date: string, amount: number) => ({ reference, date, amount })

describe('buildCustomerStatement', () => {
  it('runs a chronological balance: invoices debit, receipts/returns credit', () => {
    const s = buildCustomerStatement({
      invoices: [
        inv('INV-1', '2026-03-01T10:00:00Z', 1000),
        inv('INV-2', '2026-03-10T10:00:00Z', 500),
      ],
      receipts: [cr('REC-1', '2026-03-05T10:00:00Z', 400)],
      returns: [cr('RET-1', '2026-03-12T10:00:00Z', 100)],
    })
    expect(s.openingBalance).toBe(0)
    expect(s.lines.map((l) => [l.reference, l.balance])).toEqual([
      ['INV-1', 1000],
      ['REC-1', 600],
      ['INV-2', 1100],
      ['RET-1', 1000],
    ])
    expect(s.totalDebit).toBe(1500)
    expect(s.totalCredit).toBe(500)
    expect(s.closingBalance).toBe(1000)
  })

  it('folds pre-`from` history into the opening balance and stops at `to`', () => {
    const s = buildCustomerStatement({
      invoices: [
        inv('OLD', '2026-01-01T00:00:00Z', 700),
        inv('IN', '2026-03-02T00:00:00Z', 300),
        inv('FUTURE', '2026-05-01T00:00:00Z', 999),
      ],
      receipts: [cr('OLD-REC', '2026-01-10T00:00:00Z', 200)],
      returns: [],
      from: '2026-03-01T00:00:00Z',
      to: '2026-03-31T23:59:59Z',
    })
    expect(s.openingBalance).toBe(500) // 700 - 200
    expect(s.lines.map((l) => l.reference)).toEqual(['IN'])
    expect(s.closingBalance).toBe(800)
  })

  it('drops zero / negative receivable invoices (cash sales)', () => {
    const s = buildCustomerStatement({
      invoices: [
        inv('CASH', '2026-03-01T00:00:00Z', 0),
        inv('CREDIT', '2026-03-02T00:00:00Z', 250),
      ],
      receipts: [],
      returns: [],
    })
    expect(s.lines).toHaveLength(1)
    expect(s.lines[0]!.reference).toBe('CREDIT')
  })

  it('orders invoice before credits on the same timestamp', () => {
    const s = buildCustomerStatement({
      invoices: [inv('I', '2026-03-01T00:00:00Z', 100)],
      receipts: [cr('R', '2026-03-01T00:00:00Z', 100)],
      returns: [],
    })
    expect(s.lines.map((l) => l.kind)).toEqual(['invoice', 'receipt'])
    expect(s.closingBalance).toBe(0)
  })
})

describe('customerStatementToRows', () => {
  it('brackets the lines with opening + closing rows', () => {
    const s = buildCustomerStatement({
      invoices: [inv('I', '2026-03-01T00:00:00Z', 100)],
      receipts: [],
      returns: [],
    })
    const rows = customerStatementToRows(s)
    expect(rows[0]).toMatchObject({ type: 'opening_balance', balance: 0 })
    expect(rows.at(-1)).toMatchObject({ type: 'closing_balance', balance: 100, debit: 100 })
  })
})
