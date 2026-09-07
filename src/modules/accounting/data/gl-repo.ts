/**
 * Read repository for `general_ledger_entries` — the append-only, Function-
 * written GL (`IMPLEMENTATION_PLAN.md` §4.3). This is NOT a submittable
 * document: it is a plain paginated read. It feeds the General Ledger screen,
 * the Trial Balance screen and the hub cash-position KPI.
 *
 * Contract (`claude.md` B.5): catch raw Appwrite errors → typed `AppError`;
 * Zod-parse every row; return `Result<T, AppError>` — never throw across the
 * boundary.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { LEDGER_TOLERANCE } from '@/core/ledger'
import { fetchTrialBalance } from '@/infrastructure/appwrite/functions'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'

import { type TrialBalance } from '../domain/gl'
import { glEntryRowSchema, type GlEntryRow } from '../domain/schemas'

const SHAPE_ERROR =
  'تعذّر قراءة أحد قيود دفتر الأستاذ — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

const DEFAULT_PAGE_SIZE = 25

export interface GlEntryListParams {
  account?: string
  voucherNo?: string
  branchId?: string
  /** ISO datetime — inclusive lower bound on `posting_datetime`. */
  from?: string
  /** ISO datetime — inclusive upper bound on `posting_datetime`. */
  to?: string
  page?: number
  pageSize?: number
}

export interface GlEntryListPage {
  rows: GlEntryRow[]
  total: number
}

function rangeQueries(
  params: Pick<GlEntryListParams, 'account' | 'voucherNo' | 'branchId' | 'from' | 'to'>,
) {
  const queries: string[] = []
  if (params.account) queries.push(Query.equal('account', params.account))
  if (params.voucherNo) queries.push(Query.equal('voucher_no', params.voucherNo))
  if (params.branchId) queries.push(Query.equal('branch_id', params.branchId))
  if (params.from) queries.push(Query.greaterThanEqual('posting_datetime', params.from))
  if (params.to) queries.push(Query.lessThanEqual('posting_datetime', params.to))
  return queries
}

function parseRows(raw: unknown[]): Result<GlEntryRow[]> {
  const rows: GlEntryRow[] = []
  for (const item of raw) {
    const parsed = glEntryRowSchema.safeParse(item)
    if (!parsed.success) {
      return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
    }
    rows.push(parsed.data)
  }
  return ok(rows)
}

/** One page of GL entries, newest first. */
export async function listGlEntries(
  params: GlEntryListParams = {},
): Promise<Result<GlEntryListPage>> {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const page = params.page ?? 0
  const queries = [
    ...rangeQueries(params),
    Query.orderDesc('posting_datetime'),
    Query.limit(pageSize),
    Query.offset(page * pageSize),
  ]

  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.generalLedger,
      queries,
    })
    const parsed = parseRows(res.rows as unknown[])
    if (!parsed.ok) return parsed
    return ok({ rows: parsed.value, total: res.total })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/**
 * Full trial balance over a date range — aggregated in Postgres (`trial_balance`
 * RPC, migration 0015) over the whole GL, branch-scoped server-side. No
 * client-side row cap. The `trialBalance` reducer in `../domain/gl` stays the
 * tested specification.
 */
export async function trialBalanceRows(
  range: Pick<GlEntryListParams, 'from' | 'to'> = {},
): Promise<Result<TrialBalance>> {
  const res = await fetchTrialBalance(range.from ?? null, range.to ?? null)
  if (!res.ok) return res
  const { rows, totalDebit, totalCredit } = res.value
  return ok({
    rows,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) <= LEDGER_TOLERANCE,
  })
}

/**
 * Net movement on one account (`Σ debit − Σ credit`) over all non-cancelled
 * rows. `0` when the account has no entries.
 */
export async function accountBalance(account: string): Promise<Result<number>> {
  const tb = await trialBalanceRows()
  if (!tb.ok) return tb
  return ok(tb.value.rows.find((r) => r.account === account)?.balance ?? 0)
}
