/**
 * Customer account statement (كشف حساب) — Phase 4.1/4.2. A pure running-balance
 * ledger of what a customer owes: credit-side invoices are debits, receipts and
 * return credit notes are credits. Anything dated before the `from` bound folds
 * into the opening balance so the statement covers a period without losing
 * history.
 *
 * `domain` is pure TypeScript — no framework imports.
 */

export type StatementEntryKind = 'invoice' | 'receipt' | 'return'

export interface StatementInvoice {
  reference: string
  date: string
  /** Amount left on the customer's account for this invoice (the debit). */
  receivable: number
}
export interface StatementCredit {
  reference: string
  date: string
  amount: number
}

export interface StatementInput {
  invoices: readonly StatementInvoice[]
  receipts: readonly StatementCredit[]
  returns: readonly StatementCredit[]
  /** ISO datetime — entries strictly before this fold into the opening balance. */
  from?: string
  /** ISO datetime — entries after this are excluded. */
  to?: string
}

export interface StatementLine {
  date: string
  kind: StatementEntryKind
  reference: string
  debit: number
  credit: number
  /** Running balance after this line (positive = customer owes). */
  balance: number
}

export interface CustomerStatement {
  openingBalance: number
  lines: StatementLine[]
  totalDebit: number
  totalCredit: number
  closingBalance: number
}

const EPS = 1e-6

interface Raw {
  date: string
  kind: StatementEntryKind
  reference: string
  debit: number
  credit: number
}

/** Fold invoices + receipts + returns into a dated running-balance statement. */
export function buildCustomerStatement(input: StatementInput): CustomerStatement {
  const raws: Raw[] = [
    ...input.invoices
      .filter((i) => i.receivable > EPS)
      .map<Raw>((i) => ({
        date: i.date,
        kind: 'invoice',
        reference: i.reference,
        debit: i.receivable,
        credit: 0,
      })),
    ...input.receipts.map<Raw>((r) => ({
      date: r.date,
      kind: 'receipt',
      reference: r.reference,
      debit: 0,
      credit: r.amount,
    })),
    ...input.returns
      .filter((r) => r.amount > EPS)
      .map<Raw>((r) => ({
        date: r.date,
        kind: 'return',
        reference: r.reference,
        debit: 0,
        credit: r.amount,
      })),
  ]

  const from = input.from ?? ''
  const to = input.to ?? ''

  let openingBalance = 0
  const inPeriod: Raw[] = []
  for (const raw of raws) {
    if (to && raw.date > to) continue
    if (from && raw.date < from) {
      openingBalance += raw.debit - raw.credit
      continue
    }
    inPeriod.push(raw)
  }

  // Stable chronological order; invoices before credits on the same instant.
  const kindRank: Record<StatementEntryKind, number> = { invoice: 0, return: 1, receipt: 2 }
  inPeriod.sort((a, b) => a.date.localeCompare(b.date) || kindRank[a.kind] - kindRank[b.kind])

  let balance = openingBalance
  let totalDebit = 0
  let totalCredit = 0
  const lines: StatementLine[] = inPeriod.map((raw) => {
    balance += raw.debit - raw.credit
    totalDebit += raw.debit
    totalCredit += raw.credit
    return {
      date: raw.date,
      kind: raw.kind,
      reference: raw.reference,
      debit: raw.debit,
      credit: raw.credit,
      balance,
    }
  })

  return {
    openingBalance,
    lines,
    totalDebit,
    totalCredit,
    closingBalance: balance,
  }
}

/** Flat rows for CSV / Excel export. */
export function customerStatementToRows(statement: CustomerStatement): Array<{
  date: string
  type: string
  reference: string
  debit: number
  credit: number
  balance: number
}> {
  const out = [
    {
      date: '',
      type: 'opening_balance',
      reference: '',
      debit: 0,
      credit: 0,
      balance: statement.openingBalance,
    },
    ...statement.lines.map((l) => ({
      date: l.date,
      type: l.kind,
      reference: l.reference,
      debit: l.debit,
      credit: l.credit,
      balance: l.balance,
    })),
    {
      date: '',
      type: 'closing_balance',
      reference: '',
      debit: statement.totalDebit,
      credit: statement.totalCredit,
      balance: statement.closingBalance,
    },
  ]
  return out
}
