/**
 * Direct reads behind the Production Waste Report — deliberately NOT routed
 * through `productionBatchesRepo.list()` (the shared `DocumentRepo`), because
 * that only supports offset pagination over a fixed sort: a date-bounded
 * report needs the range pushed into the query itself, or a caller picking an
 * older period than fits in the newest page would silently get an empty
 * result. Same discipline as `@/modules/reports/data/dashboard-repo.ts`
 * (bounded scan, range pushed server-side) and its `bin_balances` lookup
 * (looked up only for the ids actually in view, chunked — not the full,
 * separately-capped catalogue list).
 */
import { DocStatus } from '@/core/doc-status'
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'
import { productsRepo, type Product } from '@/modules/admin'

import { productionBatchRowSchema, type ProductionBatch } from '../domain/schemas'

/** Newest-first, capped — a report is a bounded read, never an unbounded scan. */
export const WASTE_REPORT_SCAN_CAP = 500
/** Appwrite/PostgREST practical `IN (...)` list size per query. */
const PRODUCT_ID_CHUNK = 100

export interface WasteReportBatchesPage {
  rows: ProductionBatch[]
  /** Total Submitted batches matching the (optional) date range — not capped at {@link WASTE_REPORT_SCAN_CAP}. */
  total: number
}

/**
 * Submitted production batches, optionally bounded to `[from, to]` on
 * `posting_datetime` (either an ISO date or full datetime string — both
 * compare correctly against the stored ISO timestamp).
 */
export async function listSubmittedBatchesInRange(
  params: {
    from?: string
    to?: string
  } = {},
): Promise<Result<WasteReportBatchesPage>> {
  const queries: string[] = [
    Query.equal('doc_status', DocStatus.Submitted),
    Query.orderDesc('posting_datetime'),
    Query.limit(WASTE_REPORT_SCAN_CAP),
  ]
  if (params.from) queries.push(Query.greaterThanEqual('posting_datetime', params.from))
  if (params.to) queries.push(Query.lessThanEqual('posting_datetime', params.to))

  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.productionBatches,
      queries,
    })
    const rows: ProductionBatch[] = []
    for (const raw of res.rows) {
      const parsed = productionBatchRowSchema.safeParse(raw)
      if (!parsed.success) {
        return err(
          appError('server', 'تعذّر قراءة أوامر التشغيل — بنية غير متوقعة.', {
            detail: parsed.error.message,
          }),
        )
      }
      rows.push(parsed.data)
    }
    return ok({ rows, total: res.total })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/**
 * Products for exactly the given ids (deduped, chunked) — not the separately
 * `useProductOptions()`-capped catalogue list, so a product past that cap
 * still resolves correctly here instead of silently falling back to a 0%
 * waste allowance.
 */
export async function listProductsByIds(ids: readonly string[]): Promise<Result<Product[]>> {
  const uniqueIds = Array.from(new Set(ids))
  const out: Product[] = []
  for (let i = 0; i < uniqueIds.length; i += PRODUCT_ID_CHUNK) {
    const chunk = uniqueIds.slice(i, i + PRODUCT_ID_CHUNK)
    const res = await productsRepo.list({
      page: 0,
      pageSize: chunk.length,
      filters: [{ field: '$id', value: chunk }],
    })
    if (!res.ok) return res
    out.push(...res.value.rows)
  }
  return ok(out)
}
