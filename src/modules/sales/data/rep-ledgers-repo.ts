/**
 * Read repositories for the two rep running-balance ledgers — `rep_stock_ledger`
 * (rep as a mini-warehouse) and `rep_cash_ledger` (rep as a mini cash register).
 * Both are append-only and Function-written (`claude.md` Section C); the client
 * only ever reads them.
 *
 * Contract (`claude.md` B.5): plain `tablesDB.listRows`, Zod-parse every row,
 * catch raw errors → typed `AppError`, return `Result<T, AppError>`.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'

import {
  repCashLedgerRowSchema,
  repStockLedgerRowSchema,
  type CloseoutCashMethod,
  type RepCashLedgerRow,
  type RepStockLedgerRow,
} from '../domain/schemas'

const SHAPE_ERROR =
  'تعذّر قراءة أحد سطور دفتر المندوب — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

const DEFAULT_PAGE_SIZE = 25
/** Cap for the balance scans — a rep's ledger for one period is small. */
const BALANCE_SCAN_LIMIT = 500

export interface LedgerPage<TRow> {
  rows: TRow[]
  total: number
}

export interface RepStockLedgerParams {
  repUserId: string
  productId?: string
  page?: number
  pageSize?: number
}

export interface RepCashLedgerParams {
  repUserId: string
  method?: CloseoutCashMethod
  page?: number
  pageSize?: number
}

export async function listRepStockLedger(
  params: RepStockLedgerParams,
): Promise<Result<LedgerPage<RepStockLedgerRow>>> {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const page = params.page ?? 0
  const queries = [
    Query.equal('rep_user_id', params.repUserId),
    Query.orderDesc('posting_datetime'),
    Query.limit(pageSize),
    Query.offset(page * pageSize),
  ]
  if (params.productId) queries.push(Query.equal('product_id', params.productId))

  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.repStockLedger,
      queries,
    })
    const rows: RepStockLedgerRow[] = []
    for (const raw of res.rows) {
      const parsed = repStockLedgerRowSchema.safeParse(raw)
      if (!parsed.success)
        return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
      rows.push(parsed.data)
    }
    return ok({ rows, total: res.total })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export async function listRepCashLedger(
  params: RepCashLedgerParams,
): Promise<Result<LedgerPage<RepCashLedgerRow>>> {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const page = params.page ?? 0
  const queries = [
    Query.equal('rep_user_id', params.repUserId),
    Query.orderDesc('posting_datetime'),
    Query.limit(pageSize),
    Query.offset(page * pageSize),
  ]
  if (params.method) queries.push(Query.equal('method', params.method))

  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.repCashLedger,
      queries,
    })
    const rows: RepCashLedgerRow[] = []
    for (const raw of res.rows) {
      const parsed = repCashLedgerRowSchema.safeParse(raw)
      if (!parsed.success)
        return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
      rows.push(parsed.data)
    }
    return ok({ rows, total: res.total })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export interface RepStockBalanceRow {
  product_id: string
  qty_after: number
  posting_datetime: string
}

/** Latest `qty_after` per product for a rep — the current custody balance. */
export async function repStockBalance(repUserId: string): Promise<Result<RepStockBalanceRow[]>> {
  const listed = await listRepStockLedger({ repUserId, page: 0, pageSize: BALANCE_SCAN_LIMIT })
  if (!listed.ok) return listed
  const latest = new Map<string, RepStockBalanceRow>()
  // rows come newest-first — first sighting of a product wins.
  for (const row of listed.value.rows) {
    if (!latest.has(row.product_id)) {
      latest.set(row.product_id, {
        product_id: row.product_id,
        qty_after: row.qty_after,
        posting_datetime: row.posting_datetime,
      })
    }
  }
  return ok([...latest.values()])
}

export interface RepCashBalanceRow {
  method: CloseoutCashMethod | null
  amount_after: number
  posting_datetime: string
}

/** Latest `amount_after` per method for a rep — the current cash position. */
export async function repCashBalance(repUserId: string): Promise<Result<RepCashBalanceRow[]>> {
  const listed = await listRepCashLedger({ repUserId, page: 0, pageSize: BALANCE_SCAN_LIMIT })
  if (!listed.ok) return listed
  const latest = new Map<string, RepCashBalanceRow>()
  for (const row of listed.value.rows) {
    const key = row.method ?? 'cash'
    if (!latest.has(key)) {
      latest.set(key, {
        method: row.method ?? null,
        amount_after: row.amount_after,
        posting_datetime: row.posting_datetime,
      })
    }
  }
  return ok([...latest.values()])
}
