/**
 * Read repository for the Profit & Loss statement — Phase 4.2. It adds no new
 * backend call: the `trial_balance` RPC (migration 0015) already aggregates the
 * GL by account over a date range, branch-scoped server-side. The P&L is a pure
 * re-classification of those rows (`../domain/pnl`).
 *
 * Contract (`claude.md` B.5): raw errors are mapped by the underlying
 * `trialBalanceRows`; here we additionally Zod-check the RPC payload shape
 * before the domain trusts it (`claude.md` B.2 — parse every external payload).
 */
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'

import { buildProfitAndLoss, type ProfitAndLoss } from '../domain/pnl'
import { trialBalanceRows, type GlEntryListParams } from './gl-repo'

export type PnlRange = Pick<GlEntryListParams, 'from' | 'to'>

const tbAccountSchema = z.object({
  account: z.string(),
  debit: z.number().finite(),
  credit: z.number().finite(),
  balance: z.number().finite(),
})

/** P&L over `range` (both bounds optional — omitted ⇒ all time). */
export async function profitAndLoss(range: PnlRange = {}): Promise<Result<ProfitAndLoss>> {
  const tb = await trialBalanceRows(range)
  if (!tb.ok) return tb

  const parsed = z.array(tbAccountSchema).safeParse(tb.value.rows)
  if (!parsed.success) {
    return err(
      appError('server', 'تعذّر إعداد قائمة الدخل — بيانات غير متوقعة من الخادم.', {
        detail: parsed.error.message,
      }),
    )
  }

  return ok(buildProfitAndLoss(parsed.data))
}
