/**
 * Pure mapping from an accounting document to the balanced double-entry GL
 * lines that post it, plus a trial-balance reducer over raw GL rows.
 *
 * The data layer (`data/post-accounting.ts`) feeds these lines to the
 * `/post-gl` Function — nothing here knows about appwrite.
 *
 * ## Chart of accounts
 * Account identifiers ({@link GlAccount}) are the canonical set in
 * `@/core/accounts`, backed by the `chart_of_accounts` master table —
 * re-exported here so existing call sites (`from '../../domain/gl'`) don't
 * all need touching. `payment_vouchers.treasury_account`, when set, is used
 * verbatim as the treasury-side account string so the posting already
 * reflects the operator's intent; everything else uses the constants.
 *
 * Pure — the only imports are `@/core/ledger` and `@/core/accounts`
 * (framework-free).
 */
import { GlAccount, type AccountType, type GlAccountId } from '@/core/accounts'
import { assertBalanced, LEDGER_TOLERANCE, type GlLine } from '@/core/ledger'

import type { CapitalWithdrawal, PaymentVoucher, Receipt } from './schemas'

export { GlAccount, type GlAccountId }

const DEBIT = (account: string, amount: number): GlLine => ({ account, debit: amount, credit: 0 })
const CREDIT = (account: string, amount: number): GlLine => ({ account, debit: 0, credit: amount })

/**
 * A customer collection settles receivables:
 *   Dr Cash | Bank      (where the money landed)
 *   Cr Accounts receivable
 * `cash` → the cash account; `bank_transfer` / `post_dated_cheque` → the bank
 * account (a PDC is treated as bank-in at posting time).
 */
export function receiptToGlLines(receipt: Pick<Receipt, 'amount' | 'method'>): GlLine[] {
  const debitAccount = receipt.method === 'cash' ? GlAccount.Cash : GlAccount.Bank
  const lines = [
    DEBIT(debitAccount, receipt.amount),
    CREDIT(GlAccount.AccountsReceivable, receipt.amount),
  ]
  assertBalanced(lines)
  return lines
}

/**
 * A payment voucher moves cash through the treasury:
 *   direction `receipt`  →  Dr Treasury          Cr Other income
 *   direction `payment`  →  Dr Expense / payable  Cr Treasury
 */
export function voucherToGlLines(
  voucher: Pick<PaymentVoucher, 'direction' | 'amount' | 'treasury_account'>,
): GlLine[] {
  const treasury = voucher.treasury_account?.trim()
    ? voucher.treasury_account.trim()
    : GlAccount.Treasury
  const lines =
    voucher.direction === 'receipt'
      ? [DEBIT(treasury, voucher.amount), CREDIT(GlAccount.Other, voucher.amount)]
      : [DEBIT(GlAccount.Expense, voucher.amount), CREDIT(treasury, voucher.amount)]
  assertBalanced(lines)
  return lines
}

/**
 * An owner / investor capital contribution — cash or an existing asset:
 *   Dr <asset_account>   (cash, or a fixed-asset account for a car/property/…)
 *   Cr Owner's capital   (equity)
 */
export function capitalToGlLines(contribution: {
  amount: number
  asset_account: string
}): GlLine[] {
  const asset = contribution.asset_account.trim() || GlAccount.Cash
  const lines = [
    DEBIT(asset, contribution.amount),
    CREDIT(GlAccount.OwnersCapital, contribution.amount),
  ]
  assertBalanced(lines)
  return lines
}

/**
 * An owner / investor capital withdrawal — cash taken out of the business:
 *   Dr Owner's drawings (contra-equity)
 *   Cr <source_account>   (cash or bank — where the money left from)
 *
 * Deliberately does NOT debit `OwnersCapital` directly: a Drawings account
 * keeps every withdrawal individually visible and auditable, and keeps the
 * income statement unaffected by owner transactions — the standard treatment
 * (drawings only close into capital at period-end, a separate, explicit step,
 * not implicit in this posting).
 */
export function withdrawalToGlLines(
  withdrawal: Pick<CapitalWithdrawal, 'amount' | 'source_account'>,
): GlLine[] {
  const source = withdrawal.source_account.trim() || GlAccount.Cash
  const lines = [
    DEBIT(GlAccount.OwnersDrawings, withdrawal.amount),
    CREDIT(source, withdrawal.amount),
  ]
  assertBalanced(lines)
  return lines
}

// ---------------------------------------------------------------------------
// Trial balance
// ---------------------------------------------------------------------------

/** One account line of a trial balance. `balance = debit − credit`. */
export interface TrialBalanceAccount {
  account: string
  debit: number
  credit: number
  balance: number
  /** From `chart_of_accounts.account_type`, when the server RPC joins it
   *  (`trialBalanceRows`, not the client `trialBalance()` reducer, which has
   *  no chart-of-accounts data to join). `undefined`/`null` for an account
   *  not (yet) in the chart. */
  accountType?: AccountType | null
}

export interface TrialBalance {
  rows: TrialBalanceAccount[]
  totalDebit: number
  totalCredit: number
  /** `true` when `Σ debit === Σ credit` within ledger tolerance. */
  balanced: boolean
}

/** Minimal GL-row shape the trial balance needs. */
export interface TrialBalanceInputRow {
  account: string
  debit: number
  credit: number
  is_cancelled?: boolean | null
}

/**
 * Fold GL rows into a per-account trial balance. Cancelled rows
 * (`is_cancelled === true`) are skipped. Rows are sorted by account id.
 */
export function trialBalance(rows: readonly TrialBalanceInputRow[]): TrialBalance {
  const byAccount = new Map<string, { debit: number; credit: number }>()
  for (const row of rows) {
    if (row.is_cancelled) continue
    const acc = byAccount.get(row.account) ?? { debit: 0, credit: 0 }
    acc.debit += row.debit
    acc.credit += row.credit
    byAccount.set(row.account, acc)
  }

  const accountRows: TrialBalanceAccount[] = [...byAccount.entries()]
    .map(([account, { debit, credit }]) => ({ account, debit, credit, balance: debit - credit }))
    .sort((a, b) => a.account.localeCompare(b.account))

  const totalDebit = accountRows.reduce((sum, r) => sum + r.debit, 0)
  const totalCredit = accountRows.reduce((sum, r) => sum + r.credit, 0)

  return {
    rows: accountRows,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) <= LEDGER_TOLERANCE,
  }
}

/**
 * Net owner's equity = capital contributed − drawings taken out. Both
 * `capitalBalance` and `drawingsBalance` come from {@link TrialBalanceAccount.balance}
 * (`debit − credit`) for `GlAccount.OwnersCapital` / `GlAccount.OwnersDrawings`
 * respectively — both are credit-normal accounts on the contribution side and
 * debit-normal on the drawings side, so the account `balance` (debit − credit)
 * is negative for capital and positive for drawings; negating the sum reads it
 * back as a normal positive equity figure. `0` for either side when the
 * account has no postings yet.
 */
export function netOwnersEquity(capitalBalance: number, drawingsBalance: number): number {
  // `|| 0` normalizes a `-0` result (e.g. both balances are 0) to `+0` so
  // downstream formatting never shows a nonsensical "-0.00".
  return -(capitalBalance + drawingsBalance) || 0
}
