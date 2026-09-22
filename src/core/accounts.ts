/**
 * Canonical GL account identifiers — the `code` column of the
 * `chart_of_accounts` master table (`scripts/supabase/schema.ts`). Every
 * domain module that posts to the ledger (accounting, sales, returns)
 * imports these instead of typing its own account strings, so account ids
 * can never drift between modules (they used to: three separate,
 * independently-typed copies existed before this file).
 *
 * These are the *identifiers* used in `general_ledger_entries.account` and
 * in `chart_of_accounts.code` — never renamed once real ledger rows exist
 * under them, since renaming would silently split a historical account's
 * balance across two different strings. New accounts get new ids; existing
 * ones keep theirs forever. `chart_of_accounts.account_number` (the
 * 1000/2000/... display numbering) is a separate, purely cosmetic field —
 * safe to renumber without touching this file or any posted data.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const GlAccount = {
  Cash: 'cash',
  Bank: 'bank',
  Treasury: 'treasury',
  AccountsReceivable: 'accounts_receivable',
  AccountsPayable: 'accounts_payable',
  FixedAssetsVehicles: 'fixed_assets_vehicles',
  FixedAssetsProperty: 'fixed_assets_property',
  FixedAssetsEquipment: 'fixed_assets_equipment',
  FixedAssetsOther: 'fixed_assets_other',
  OwnersCapital: 'owners_capital',
  /** Contra-equity: owner/investor withdrawals, netted against OwnersCapital
   *  when computing equity — never posted as a direct debit to the capital
   *  account itself. */
  OwnersDrawings: 'owners_drawings',
  SalesRevenue: 'sales_revenue',
  /** Contra-revenue. */
  SalesReturns: 'sales_returns',
  Other: 'other',
  Expense: 'expense',
} as const

export type GlAccountId = (typeof GlAccount)[keyof typeof GlAccount]

/** "Cash-like" accounts — the ones a cash-flow statement's cash balance and
 *  the accounting hub's cash-position KPI sum together. */
export const CASH_LIKE_ACCOUNTS: readonly GlAccountId[] = [
  GlAccount.Cash,
  GlAccount.Bank,
  GlAccount.Treasury,
]

/** Account type of every seeded account, for anything that can't wait on a
 *  `chart_of_accounts` row (e.g. a client-side default before the table has
 *  loaded). The database row is the source of truth once it exists — this is
 *  a fallback / seed reference, not a second copy to keep manually in sync by
 *  hand elsewhere. */
export const SEEDED_ACCOUNT_TYPE: Record<GlAccountId, AccountType> = {
  [GlAccount.Cash]: 'asset',
  [GlAccount.Bank]: 'asset',
  [GlAccount.Treasury]: 'asset',
  [GlAccount.AccountsReceivable]: 'asset',
  [GlAccount.FixedAssetsVehicles]: 'asset',
  [GlAccount.FixedAssetsProperty]: 'asset',
  [GlAccount.FixedAssetsEquipment]: 'asset',
  [GlAccount.FixedAssetsOther]: 'asset',
  [GlAccount.AccountsPayable]: 'liability',
  [GlAccount.OwnersCapital]: 'equity',
  [GlAccount.OwnersDrawings]: 'equity',
  [GlAccount.SalesRevenue]: 'income',
  [GlAccount.SalesReturns]: 'income',
  [GlAccount.Other]: 'income',
  [GlAccount.Expense]: 'expense',
}
