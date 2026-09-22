/**
 * Balance sheet — Assets = Liabilities + Equity, at a point in time.
 *
 * Classification is data-driven from `chart_of_accounts.account_type`
 * (joined server-side by the `trial_balance` RPC), not name-guessing — the
 * one thing the chart of accounts exists to fix.
 *
 * This system posts no formal period-end closing entries (income/expense
 * accounts are never zeroed into equity), so their cumulative net effect —
 * `netIncome`, the same figure `buildProfitAndLoss` produces — is folded in
 * here as "retained earnings" so the sheet actually balances. This is the
 * standard simplified-ERP approach: the closing entry is implicit at query
 * time rather than a posted journal entry.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import { LEDGER_TOLERANCE } from '@/core/ledger'

import type { TrialBalanceAccount } from './gl'

export interface BalanceSheetLine {
  account: string
  /** Natural sign for the section it's in — positive means "adds to the
   *  section's total" (an asset increase, a liability increase, an equity
   *  increase). */
  amount: number
}

export interface BalanceSheetSection {
  lines: BalanceSheetLine[]
  total: number
}

export interface BalanceSheet {
  asOf: string
  assets: BalanceSheetSection
  liabilities: BalanceSheetSection
  /** Equity accounts posted directly (owners_capital, owners_drawings, …) —
   *  excludes retained earnings, reported separately below. */
  capital: BalanceSheetSection
  /** Cumulative net income to date — the implicit "closing entry". */
  retainedEarnings: number
  /** `capital.total + retainedEarnings`. */
  totalEquity: number
  /** `liabilities.total + totalEquity` — should equal `assets.total`. */
  totalLiabilitiesAndEquity: number
  /** `true` when `assets.total === totalLiabilitiesAndEquity` within tolerance. */
  balanced: boolean
}

function emptySection(): BalanceSheetSection {
  return { lines: [], total: 0 }
}

function pushLine(section: BalanceSheetSection, account: string, amount: number): void {
  if (Math.abs(amount) <= LEDGER_TOLERANCE) return
  section.lines.push({ account, amount })
  section.total += amount
}

/**
 * `rows` — trial-balance rows carrying `accountType` (only `trialBalanceRows`,
 * the server-aggregated read, populates it — the client `trialBalance()`
 * reducer has no chart-of-accounts data to join, so don't feed it here).
 * `netIncome` — cumulative net income for the same as-of range, e.g. from
 * `buildProfitAndLoss(sameRows)` or the `profitAndLoss` data function with
 * `{ to: asOf }` and no `from`.
 */
export function buildBalanceSheet(
  rows: readonly TrialBalanceAccount[],
  netIncome: number,
  asOf: string,
): BalanceSheet {
  const assets = emptySection()
  const liabilities = emptySection()
  const capital = emptySection()

  for (const row of rows) {
    const balance = Number(row.balance)
    if (!Number.isFinite(balance)) continue // never let schema drift poison a total with NaN
    switch (row.accountType) {
      case 'asset':
        // Debit-normal — the trial-balance sign is already the natural one.
        pushLine(assets, row.account, balance)
        break
      case 'liability':
        // Credit-normal — negate `debit − credit` to read as a positive amount owed.
        pushLine(liabilities, row.account, -balance)
        break
      case 'equity':
        pushLine(capital, row.account, -balance)
        break
      // income/expense/null (not yet in the chart of accounts) never appear
      // on the balance sheet directly — their cumulative effect is `netIncome`.
      default:
        break
    }
  }

  for (const section of [assets, liabilities, capital]) {
    section.lines.sort((a, b) => a.account.localeCompare(b.account))
  }

  const totalEquity = capital.total + netIncome
  const totalLiabilitiesAndEquity = liabilities.total + totalEquity

  return {
    asOf,
    assets,
    liabilities,
    capital,
    retainedEarnings: netIncome,
    totalEquity,
    totalLiabilitiesAndEquity,
    balanced: Math.abs(assets.total - totalLiabilitiesAndEquity) <= LEDGER_TOLERANCE,
  }
}
