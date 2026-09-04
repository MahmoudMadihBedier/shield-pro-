/**
 * Pure mapping from an accounting document to the balanced double-entry GL
 * lines that post it, plus a trial-balance reducer over raw GL rows.
 *
 * The data layer (`data/post-accounting.ts`) feeds these lines to the
 * `/post-gl` Function — nothing here knows about appwrite.
 *
 * ## Chart of accounts
 * A real chart of accounts is a later story. For now account identifiers are
 * plain strings ({@link GlAccount}). `payment_vouchers.treasury_account`, when
 * set, is used verbatim as the treasury-side account string so the posting
 * already reflects the operator's intent; everything else uses the constants.
 *
 * Pure — the only import is `@/core/ledger` (framework-free ledger math).
 */
import { assertBalanced, LEDGER_TOLERANCE, type GlLine } from '@/core/ledger'

import type { PaymentVoucher, Receipt } from './schemas'

/** Well-known account identifiers (placeholder chart of accounts). */
export const GlAccount = {
  Cash: 'cash',
  Bank: 'bank',
  AccountsReceivable: 'accounts_receivable',
  AccountsPayable: 'accounts_payable',
  Treasury: 'treasury',
  Income: 'income',
  Expense: 'expense',
  Other: 'other',
} as const

export type GlAccountId = (typeof GlAccount)[keyof typeof GlAccount]

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

// ---------------------------------------------------------------------------
// Trial balance
// ---------------------------------------------------------------------------

/** One account line of a trial balance. `balance = debit − credit`. */
export interface TrialBalanceAccount {
  account: string
  debit: number
  credit: number
  balance: number
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
