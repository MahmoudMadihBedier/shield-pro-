/**
 * Profit & Loss statement — Phase 4.2. A pure re-classification of trial-balance
 * account rows (from the live GL, branch-scoped server-side) into the standard
 * P&L sections, with the running subtotals down to net profit.
 *
 * The chart of accounts is still the placeholder string set from `./gl` +
 * `sales`/`returns` (`sales_revenue`, `sales_returns`, `expense`, `other`, …).
 * Classification is therefore by an explicit known-account map plus a keyword
 * fallback; anything that looks like a balance-sheet account (cash, bank,
 * receivable, payable, capital, …) is left off the statement entirely.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import { LEDGER_TOLERANCE } from '@/core/ledger'

import type { TrialBalanceAccount } from './gl'

export const PnlSection = {
  Revenue: 'revenue',
  ContraRevenue: 'contra_revenue',
  Cogs: 'cogs',
  OperatingExpense: 'operating_expense',
  OtherIncome: 'other_income',
  OtherExpense: 'other_expense',
} as const

export type PnlSectionId = (typeof PnlSection)[keyof typeof PnlSection]

/** `null` ⇒ not a P&L account (balance sheet / equity) — excluded. */
export type PnlClass = PnlSectionId | null

const KNOWN: Record<string, PnlClass> = {
  sales_revenue: PnlSection.Revenue,
  income: PnlSection.Revenue,
  service_revenue: PnlSection.Revenue,
  sales_returns: PnlSection.ContraRevenue,
  cogs: PnlSection.Cogs,
  cost_of_goods_sold: PnlSection.Cogs,
  expense: PnlSection.OperatingExpense,
  operating_expense: PnlSection.OperatingExpense,
  payroll_expense: PnlSection.OperatingExpense,
  other: PnlSection.OtherIncome,
  other_income: PnlSection.OtherIncome,
  other_expense: PnlSection.OtherExpense,
  // explicit balance-sheet accounts — never on the P&L
  cash: null,
  bank: null,
  treasury: null,
  accounts_receivable: null,
  accounts_payable: null,
  owners_capital: null,
}

/**
 * Which P&L section an account belongs to. Known accounts win; otherwise a
 * keyword scan; otherwise `null` (kept off the statement).
 */
export function classifyAccount(account: string): PnlClass {
  const key = account.trim().toLowerCase()
  if (key in KNOWN) return KNOWN[key]!

  if (key.includes('cogs') || key.includes('cost_of_goods')) return PnlSection.Cogs
  // Contra-revenue only for sales-side reductions — a *purchase* return / a
  // discount *received* belongs on the cost side, so leave those unclassified
  // until a real chart of accounts lands.
  if (key === 'returns' || key.includes('sales_return') || key.includes('returns_inward')) {
    return PnlSection.ContraRevenue
  }
  if (key.includes('discount_allowed')) return PnlSection.ContraRevenue
  if (key.includes('revenue') || key.includes('sales') || key.includes('income')) {
    return key.includes('other') ? PnlSection.OtherIncome : PnlSection.Revenue
  }
  if (key.includes('expense') || key.endsWith('_exp')) {
    return PnlSection.OperatingExpense
  }
  return null
}

/** One account line under a section. `amount` is always the natural sign of
 *  that section (revenue positive, expense positive). */
export interface PnlLine {
  account: string
  amount: number
}

export interface PnlSectionResult {
  section: PnlSectionId
  lines: PnlLine[]
  total: number
}

export interface ProfitAndLoss {
  revenue: PnlSectionResult
  contraRevenue: PnlSectionResult
  /** Revenue − contra-revenue. */
  netRevenue: number
  cogs: PnlSectionResult
  /** Net revenue − COGS. */
  grossProfit: number
  operatingExpense: PnlSectionResult
  /** Gross profit − operating expenses. */
  operatingProfit: number
  otherIncome: PnlSectionResult
  otherExpense: PnlSectionResult
  /** Operating profit + other income − other expense. */
  netProfit: number
  /** `netProfit / netRevenue`, `0` when there is no revenue. */
  netMargin: number
}

/** Revenue-type sections carry a credit balance; expense-type a debit balance. */
const IS_CREDIT_SECTION: Record<PnlSectionId, boolean> = {
  [PnlSection.Revenue]: true,
  [PnlSection.OtherIncome]: true,
  [PnlSection.ContraRevenue]: false,
  [PnlSection.Cogs]: false,
  [PnlSection.OperatingExpense]: false,
  [PnlSection.OtherExpense]: false,
}

function emptySection(section: PnlSectionId): PnlSectionResult {
  return { section, lines: [], total: 0 }
}

/**
 * Fold trial-balance rows into a P&L. `balance = debit − credit`, so a
 * credit-balance section contributes `−balance` and a debit-balance section
 * `+balance`; near-zero lines (within ledger tolerance) are dropped.
 */
export function buildProfitAndLoss(rows: readonly TrialBalanceAccount[]): ProfitAndLoss {
  const sections: Record<PnlSectionId, PnlSectionResult> = {
    [PnlSection.Revenue]: emptySection(PnlSection.Revenue),
    [PnlSection.ContraRevenue]: emptySection(PnlSection.ContraRevenue),
    [PnlSection.Cogs]: emptySection(PnlSection.Cogs),
    [PnlSection.OperatingExpense]: emptySection(PnlSection.OperatingExpense),
    [PnlSection.OtherIncome]: emptySection(PnlSection.OtherIncome),
    [PnlSection.OtherExpense]: emptySection(PnlSection.OtherExpense),
  }

  for (const row of rows) {
    const cls = classifyAccount(row.account)
    if (cls === null) continue
    const balance = Number(row.balance)
    if (!Number.isFinite(balance)) continue // never let schema drift poison a total with NaN
    const amount = IS_CREDIT_SECTION[cls] ? -balance : balance
    if (Math.abs(amount) <= LEDGER_TOLERANCE) continue
    const target = sections[cls]
    target.lines.push({ account: row.account, amount })
    target.total += amount
  }

  for (const s of Object.values(sections)) {
    s.lines.sort((a, b) => a.account.localeCompare(b.account))
  }

  const netRevenue = sections[PnlSection.Revenue].total - sections[PnlSection.ContraRevenue].total
  const grossProfit = netRevenue - sections[PnlSection.Cogs].total
  const operatingProfit = grossProfit - sections[PnlSection.OperatingExpense].total
  const netProfit =
    operatingProfit +
    sections[PnlSection.OtherIncome].total -
    sections[PnlSection.OtherExpense].total

  return {
    revenue: sections[PnlSection.Revenue],
    contraRevenue: sections[PnlSection.ContraRevenue],
    netRevenue,
    cogs: sections[PnlSection.Cogs],
    grossProfit,
    operatingExpense: sections[PnlSection.OperatingExpense],
    operatingProfit,
    otherIncome: sections[PnlSection.OtherIncome],
    otherExpense: sections[PnlSection.OtherExpense],
    netProfit,
    netMargin: Math.abs(netRevenue) > LEDGER_TOLERANCE ? netProfit / netRevenue : 0,
  }
}

export interface PnlExportRow {
  section: string
  account: string
  /** Signed the way the statement reads: deductions negative, so the line
   *  items foot to the subtotal marker rows. */
  amount: number
}

/**
 * Flat rows for CSV / Excel export. Deduction sections (returns, COGS, opex,
 * other expense) are emitted negative so a reader can add the column straight
 * down to each subtotal / to net profit. Amounts are full precision — the
 * spreadsheet, not this function, decides display rounding.
 */
export function profitAndLossToRows(pnl: ProfitAndLoss): PnlExportRow[] {
  const out: PnlExportRow[] = []
  const push = (s: PnlSectionResult, sign: 1 | -1) => {
    for (const line of s.lines) {
      out.push({ section: s.section, account: line.account, amount: sign * line.amount })
    }
    out.push({ section: s.section, account: 'TOTAL', amount: sign * s.total })
  }
  push(pnl.revenue, 1)
  push(pnl.contraRevenue, -1)
  out.push({ section: 'net_revenue', account: '', amount: pnl.netRevenue })
  push(pnl.cogs, -1)
  out.push({ section: 'gross_profit', account: '', amount: pnl.grossProfit })
  push(pnl.operatingExpense, -1)
  out.push({ section: 'operating_profit', account: '', amount: pnl.operatingProfit })
  push(pnl.otherIncome, 1)
  push(pnl.otherExpense, -1)
  out.push({ section: 'net_profit', account: '', amount: pnl.netProfit })
  return out
}
