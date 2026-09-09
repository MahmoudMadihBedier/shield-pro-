/**
 * Customer account statement (كشف حساب) — Phase 4.1/4.2. A pure running-balance
 * ledger of what a customer owes: credit-side invoices are debits, receipts and
 * return credit notes are credits. Anything dated before the `from` bound folds
 * into the opening balance so the statement covers a period without losing
 * history.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import { RECEIVABLE_INVOICE_METHODS } from './aging'

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

/** Round to whole cents so float drift never surfaces as a stray balance. */
function money(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

/** Epoch ms for a timestamp comparison (Postgres `+00:00` vs JS `.000Z`). */
function t(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? 0 : ms
}

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

  const fromMs = input.from ? t(input.from) : -Infinity
  const toMs = input.to ? t(input.to) : Infinity

  let openingBalance = 0
  const inPeriod: Raw[] = []
  for (const raw of raws) {
    const ms = t(raw.date)
    if (ms > toMs) continue
    if (ms < fromMs) {
      openingBalance += raw.debit - raw.credit
      continue
    }
    inPeriod.push(raw)
  }
  openingBalance = money(openingBalance)

  // Stable chronological order; invoices before credits on the same instant.
  const kindRank: Record<StatementEntryKind, number> = { invoice: 0, return: 1, receipt: 2 }
  inPeriod.sort((a, b) => t(a.date) - t(b.date) || kindRank[a.kind] - kindRank[b.kind])

  let balance = openingBalance
  let totalDebit = 0
  let totalCredit = 0
  const lines: StatementLine[] = inPeriod.map((raw) => {
    balance = money(balance + raw.debit - raw.credit)
    totalDebit += raw.debit
    totalCredit += raw.credit
    return {
      date: raw.date,
      kind: raw.kind,
      reference: raw.reference,
      debit: money(raw.debit),
      credit: money(raw.credit),
      balance,
    }
  })

  return {
    openingBalance,
    lines,
    totalDebit: money(totalDebit),
    totalCredit: money(totalCredit),
    closingBalance: balance,
  }
}

/**
 * Which submitted sales invoices land on a customer's statement, and their
 * debit amount. Mirrors `RECEIVABLE_INVOICE_METHODS` in `./aging` — a cash /
 * bank-transfer sale is settled at the till and never hits the account. The
 * full `net_total` is the debit (receipts, incl. any at-sale cash, are separate
 * credit lines), so the statement's closing balance matches the aging report.
 */
export function pickReceivableInvoices<
  T extends {
    reference_id: string
    posting_datetime: string
    net_total: number
    payment_method: string
  },
>(invoices: readonly T[]): StatementInvoice[] {
  const receivable: ReadonlySet<string> = new Set(RECEIVABLE_INVOICE_METHODS)
  return invoices
    .filter((i) => receivable.has(i.payment_method))
    .map((i) => ({
      reference: i.reference_id,
      date: i.posting_datetime,
      receivable: i.net_total,
    }))
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
