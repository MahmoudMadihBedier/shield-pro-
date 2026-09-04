/**
 * Read repository for `bin_balances` — the read-only projection of the stock
 * ledger (`IMPLEMENTATION_PLAN.md` §4.3). This is NOT a submittable document:
 * it is a plain paginated read. It feeds the "stock on hand" screen and the
 * count-session recorded-qty lookup.
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

import { binBalanceRowSchema, type BinBalance } from '../domain/schemas'

const SHAPE_ERROR =
  'تعذّر قراءة أحد أرصدة المخزون — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

const DEFAULT_PAGE_SIZE = 25

export interface BinBalanceListParams {
  warehouseId?: string
  productId?: string
  /** `startsWith` on `product_id` — a coarse client-provided filter. */
  search?: string
  page?: number
  pageSize?: number
}

export interface BinBalanceListPage {
  rows: BinBalance[]
  total: number
}

export async function listBinBalances(
  params: BinBalanceListParams = {},
): Promise<Result<BinBalanceListPage>> {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const page = params.page ?? 0
  const queries: string[] = [
    Query.limit(pageSize),
    Query.offset(page * pageSize),
    Query.orderDesc('updated_datetime'),
  ]
  if (params.warehouseId) queries.push(Query.equal('warehouse_id', params.warehouseId))
  if (params.productId) queries.push(Query.equal('product_id', params.productId))
  const term = params.search?.trim()
  if (term) queries.push(Query.startsWith('product_id', term))

  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.binBalances,
      queries,
    })
    const rows: BinBalance[] = []
    for (const raw of res.rows) {
      const parsed = binBalanceRowSchema.safeParse(raw)
      if (!parsed.success) {
        return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
      }
      rows.push(parsed.data)
    }
    return ok({ rows, total: res.total })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/**
 * Current on-hand qty for one product in one warehouse. Returns `ok(0)` when no
 * bin row exists yet (the projection only materialises after the first move).
 */
export async function getBinQty(
  productId: string,
  warehouseId: string,
): Promise<Result<number>> {
  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.binBalances,
      queries: [
        Query.equal('product_id', productId),
        Query.equal('warehouse_id', warehouseId),
        Query.limit(1),
      ],
    })
    const raw = res.rows[0]
    if (!raw) return ok(0)

    const parsed = binBalanceRowSchema.safeParse(raw)
    if (!parsed.success) {
      return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
    }
    return ok(parsed.data.qty)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
