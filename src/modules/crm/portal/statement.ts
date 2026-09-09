/**
 * Customer-portal account statement — a pure merge of the customer's own
 * submitted invoices (debits) and receipts (credits) into one dated
 * running-balance ledger. The portal has no server statement route; this is a
 * display fold of the two `portal_*` list reads it already makes.
 *
 * Only `doc_status === 1` (Submitted) rows count toward the balance — a Draft
 * or Cancelled document is not money owed. Framework-free.
 */
import { roundCents } from '@/core/money'

const SUBMITTED = 1

export interface PortalStatementInvoice {
  id: string
  referenceId: string
  netTotal: number
  postingDatetime: string
  docStatus: number
}
export interface PortalStatementReceipt {
  id: string
  invoiceRef: string
  amount: number
  postingDatetime: string
  docStatus: number
}

export interface PortalStatementRow {
  kind: 'invoice' | 'receipt'
  id: string
  date: string
  reference: string
  debit: number
  credit: number
  /** Running balance after this row — positive = the customer owes. */
  balance: number
}

export interface PortalStatement {
  rows: PortalStatementRow[]
  totalDebit: number
  totalCredit: number
  closingBalance: number
}

/** Epoch ms for a chronological sort; unparseable dates sort last. */
function ms(iso: string): number {
  const t = Date.parse(iso)
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

export function buildPortalStatement(input: {
  invoices: readonly PortalStatementInvoice[]
  receipts: readonly PortalStatementReceipt[]
}): PortalStatement {
  type Raw = Omit<PortalStatementRow, 'balance'>

  const raws: Raw[] = [
    ...input.invoices
      .filter((i) => i.docStatus === SUBMITTED)
      .map<Raw>((i) => ({
        kind: 'invoice',
        id: i.id,
        date: i.postingDatetime,
        reference: i.referenceId,
        debit: Math.max(0, i.netTotal),
        credit: 0,
      })),
    ...input.receipts
      .filter((r) => r.docStatus === SUBMITTED)
      .map<Raw>((r) => ({
        kind: 'receipt',
        id: r.id,
        date: r.postingDatetime,
        reference: r.invoiceRef,
        debit: 0,
        credit: Math.max(0, r.amount),
      })),
  ]

  // Oldest first for the running balance; invoice before receipt on a tie.
  raws.sort(
    (a, b) => ms(a.date) - ms(b.date) || (a.kind === b.kind ? 0 : a.kind === 'invoice' ? -1 : 1),
  )

  let balance = 0
  let totalDebit = 0
  let totalCredit = 0
  const rows: PortalStatementRow[] = raws.map((raw) => {
    balance = roundCents(balance + raw.debit - raw.credit)
    totalDebit += raw.debit
    totalCredit += raw.credit
    return { ...raw, debit: roundCents(raw.debit), credit: roundCents(raw.credit), balance }
  })

  return {
    rows,
    totalDebit: roundCents(totalDebit),
    totalCredit: roundCents(totalCredit),
    closingBalance: balance,
  }
}
