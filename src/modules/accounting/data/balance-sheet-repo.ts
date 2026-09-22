/**
 * Read repository for the balance sheet. No new backend call: it composes two
 * already-existing reads for the same as-of date — `trial_balance` (now
 * joined to `chart_of_accounts` for `accountType`) and the P&L's net income
 * (the implicit "retained earnings" closing figure) — and folds them through
 * the pure `buildBalanceSheet`.
 */
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'

import { buildBalanceSheet, type BalanceSheet } from '../domain/balance-sheet'
import { buildProfitAndLoss } from '../domain/pnl'
import { trialBalanceRows } from './gl-repo'

const tbAccountSchema = z.object({
  account: z.string(),
  debit: z.number().finite(),
  credit: z.number().finite(),
  balance: z.number().finite(),
  accountType: z.enum(['asset', 'liability', 'equity', 'income', 'expense']).nullish(),
})

/** Balance sheet as of `asOf` (an ISO date/datetime string) — all-time cumulative. */
export async function balanceSheet(asOf: string): Promise<Result<BalanceSheet>> {
  const tb = await trialBalanceRows({ to: asOf })
  if (!tb.ok) return tb

  const parsed = z.array(tbAccountSchema).safeParse(tb.value.rows)
  if (!parsed.success) {
    return err(
      appError('server', 'تعذّر إعداد الميزانية العمومية — بيانات غير متوقعة من الخادم.', {
        detail: parsed.error.message,
      }),
    )
  }

  const netIncome = buildProfitAndLoss(parsed.data).netProfit
  return ok(buildBalanceSheet(parsed.data, netIncome, asOf))
}
