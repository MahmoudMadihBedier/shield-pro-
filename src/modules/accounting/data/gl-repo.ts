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
import { Query, tablesDB } from '@/infrastructure/appwrite/services'

import { trialBalance, type TrialBalance } from '../domain/gl'
import { glEntryRowSchema, type GlEntryRow } from '../domain/schemas'

const SHAPE_ERROR =
  'تعذّر قراءة أحد قيود دفتر الأستاذ — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

const DEFAULT_PAGE_SIZE = 25
/** Hard cap for the "pull everything then aggregate" reads (balance / TB). */
const AGGREGATE_SCAN_CAP = 5_000
const SCAN_PAGE = 100

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

/** Pull every GL row matching `filter` (up to the scan cap), oldest first. */
async function scanGlEntries(
  filter: Pick<GlEntryListParams, 'account' | 'voucherNo' | 'branchId' | 'from' | 'to'>,
): Promise<Result<GlEntryRow[]>> {
  const base = rangeQueries(filter)
  const collected: GlEntryRow[] = []
  try {
    for (let offset = 0; offset < AGGREGATE_SCAN_CAP; offset += SCAN_PAGE) {
      const res = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: Tables.generalLedger,
        queries: [
          ...base,
          Query.orderAsc('posting_datetime'),
          Query.limit(SCAN_PAGE),
          Query.offset(offset),
        ],
      })
      const parsed = parseRows(res.rows as unknown[])
      if (!parsed.ok) return parsed
      collected.push(...parsed.value)
      if (res.rows.length < SCAN_PAGE) break
    }
    return ok(collected)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/**
 * Net movement on one account (`Σ debit − Σ credit`) over all non-cancelled
 * rows. `0` when the account has no entries.
 */
export async function accountBalance(account: string): Promise<Result<number>> {
  const scan = await scanGlEntries({ account })
  if (!scan.ok) return scan
  const tb = trialBalance(scan.value)
  return ok(tb.rows.find((r) => r.account === account)?.balance ?? 0)
}

/** Full trial balance over a date range, computed by the domain reducer. */
export async function trialBalanceRows(
  range: Pick<GlEntryListParams, 'from' | 'to' | 'branchId'> = {},
): Promise<Result<TrialBalance>> {
  const scan = await scanGlEntries(range)
  if (!scan.ok) return scan
  return ok(trialBalance(scan.value))
}
