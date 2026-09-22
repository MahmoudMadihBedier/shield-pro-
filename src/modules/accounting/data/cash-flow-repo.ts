/**
 * Read repository for the cash flow statement. Composes reads that already
 * exist for other reports — two trial-balance snapshots (period start and
 * end), the period's P&L for net income, and the `cash_flow_financing` RPC
 * for the one thing a plain snapshot can't tell apart (cash-settled vs
 * non-cash capital movements) — through the pure `buildCashFlowStatement`.
 */
import { z } from 'zod'

import { CASH_LIKE_ACCOUNTS, GlAccount } from '@/core/accounts'
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { fetchCashFlowFinancing } from '@/infrastructure/appwrite/functions'

import { buildCashFlowStatement, type CashFlowStatement } from '../domain/cash-flow'
import { buildProfitAndLoss } from '../domain/pnl'
import { trialBalanceRows, type GlEntryListParams } from './gl-repo'

export type CashFlowRange = Required<Pick<GlEntryListParams, 'from' | 'to'>>

const tbAccountSchema = z.object({
  account: z.string(),
  debit: z.number().finite(),
  credit: z.number().finite(),
  balance: z.number().finite(),
  accountType: z.enum(['asset', 'liability', 'equity', 'income', 'expense']).nullish(),
})

function accountBalance(
  rows: readonly { account: string; balance: number }[],
  account: string,
): number {
  return rows.find((r) => r.account === account)?.balance ?? 0
}

function cashLikeTotal(rows: readonly { account: string; balance: number }[]): number {
  return CASH_LIKE_ACCOUNTS.reduce((sum, account) => sum + accountBalance(rows, account), 0)
}

/** One millisecond before `iso` — the instant just before the period opens,
 *  so "balance at period start" excludes anything posted exactly at it. */
function justBefore(iso: string): string {
  return new Date(new Date(iso).getTime() - 1).toISOString()
}

export async function cashFlowStatement(range: CashFlowRange): Promise<Result<CashFlowStatement>> {
  const [startTb, endTb, pnl, financing] = await Promise.all([
    trialBalanceRows({ to: justBefore(range.from) }),
    trialBalanceRows({ to: range.to }),
    (async () => {
      const tb = await trialBalanceRows(range)
      if (!tb.ok) return tb
      const parsed = z.array(tbAccountSchema).safeParse(tb.value.rows)
      if (!parsed.success) {
        return err(
          appError('server', 'تعذّر إعداد قائمة التدفقات النقدية.', {
            detail: parsed.error.message,
          }),
        )
      }
      return ok(buildProfitAndLoss(parsed.data).netProfit)
    })(),
    fetchCashFlowFinancing(range.from, range.to),
  ])

  if (!startTb.ok) return startTb
  if (!endTb.ok) return endTb
  if (!pnl.ok) return pnl
  if (!financing.ok) return financing

  const startRows = startTb.value.rows
  const endRows = endTb.value.rows

  const arChange =
    accountBalance(endRows, GlAccount.AccountsReceivable) -
    accountBalance(startRows, GlAccount.AccountsReceivable)
  // AP is credit-normal — negate the raw debit−credit delta so "grew" reads
  // positive, matching accountsReceivableChange's convention (see domain/cash-flow.ts).
  const apChange = -(
    accountBalance(endRows, GlAccount.AccountsPayable) -
    accountBalance(startRows, GlAccount.AccountsPayable)
  )

  return ok(
    buildCashFlowStatement({
      netIncome: pnl.value,
      accountsReceivableChange: arChange,
      accountsPayableChange: apChange,
      capitalContributed: financing.value.capitalContributed,
      capitalWithdrawn: financing.value.capitalWithdrawn,
      cashBeginning: cashLikeTotal(startRows),
      cashEnding: cashLikeTotal(endRows),
    }),
  )
}
