/**
 * Cash flow statement — indirect method, the ERP-standard approach (derived
 * from net income + balance-sheet deltas, not a second ledger of raw cash
 * transactions). Three sections:
 *   - Operating: net income, adjusted for the change in working-capital
 *     accounts (AR, AP) over the period.
 *   - Investing: nothing this system can post today (a non-cash capital
 *     contribution — a vehicle, a building — never moves cash, so it isn't
 *     investing activity here; a real "buy a fixed asset with cash" flow
 *     would land in this section once one exists). Kept as a real section,
 *     reporting zero, for the standard three-section shape.
 *   - Financing: capital contributed (cash-settled only) minus capital
 *     withdrawn, for the period.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import { LEDGER_TOLERANCE } from '@/core/ledger'

export interface CashFlowInputs {
  /** Net income for the period (e.g. `buildProfitAndLoss({from,to}).netProfit`). */
  netIncome: number
  /** Accounts-receivable balance at period end minus at period start.
   *  Positive when AR grew (revenue recognized but not yet collected). */
  accountsReceivableChange: number
  /**
   * Accounts-payable INCREASE over the period, as a plain positive-when-grew
   * number — the same intuitive sign as {@link accountsReceivableChange}, NOT
   * the raw `debit − credit` trial-balance delta (which is negative when a
   * credit-normal liability grows — the caller must negate it before passing
   * it here). Positive when AP grew (an expense was recognized but not yet
   * paid, so the cash stayed put).
   */
  accountsPayableChange: number
  /** Cash-settled capital contributed in the period (`cash_flow_financing` RPC). */
  capitalContributed: number
  /** Capital withdrawn in the period. */
  capitalWithdrawn: number
  /** Actual cash+bank+treasury balance at period start. */
  cashBeginning: number
  /** Actual cash+bank+treasury balance at period end. */
  cashEnding: number
}

export interface CashFlowStatement {
  netIncome: number
  accountsReceivableChange: number
  accountsPayableChange: number
  operatingActivities: number
  investingActivities: number
  capitalContributed: number
  capitalWithdrawn: number
  financingActivities: number
  netChangeInCash: number
  cashBeginning: number
  cashEnding: number
  /** `cashBeginning + netChangeInCash` — should equal `cashEnding`. */
  computedCashEnding: number
  /** `true` when `computedCashEnding === cashEnding` within tolerance — a
   *  sanity check that nothing was double-counted or missed. */
  reconciles: boolean
}

/**
 * An increase in a receivable (an asset) consumes cash — revenue was
 * recognized but not yet collected — so it's subtracted. An increase in a
 * payable (a liability) conserves cash — an expense was recognized but not
 * yet paid — so it's added. Both inputs are pre-normalized to "positive means
 * grew" (see {@link CashFlowInputs}), so the formula is a plain add/subtract.
 */
export function buildCashFlowStatement(inputs: CashFlowInputs): CashFlowStatement {
  const operatingActivities =
    inputs.netIncome - inputs.accountsReceivableChange + inputs.accountsPayableChange
  const investingActivities = 0
  const financingActivities = inputs.capitalContributed - inputs.capitalWithdrawn
  const netChangeInCash = operatingActivities + investingActivities + financingActivities
  const computedCashEnding = inputs.cashBeginning + netChangeInCash

  return {
    netIncome: inputs.netIncome,
    accountsReceivableChange: inputs.accountsReceivableChange,
    accountsPayableChange: inputs.accountsPayableChange,
    operatingActivities,
    investingActivities,
    capitalContributed: inputs.capitalContributed,
    capitalWithdrawn: inputs.capitalWithdrawn,
    financingActivities,
    netChangeInCash,
    cashBeginning: inputs.cashBeginning,
    cashEnding: inputs.cashEnding,
    computedCashEnding,
    reconciles: Math.abs(computedCashEnding - inputs.cashEnding) <= LEDGER_TOLERANCE,
  }
}
