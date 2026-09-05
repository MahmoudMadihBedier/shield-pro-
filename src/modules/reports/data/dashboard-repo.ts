/**
 * Read layer behind the reports dashboard (Phase 4 Story 4.4). This module
 * does not own any table — it is a reporting/read layer over tables owned by
 * other modules, so (per `claude.md` B.3) it does NOT use `@/shared/documents`
 * and does NOT import `@/modules/sales` or `@/modules/inventory` (built in
 * parallel / out of scope for cross-module imports here): `sales_invoices` and
 * `bin_balances` get their own minimal local Zod projections, mirroring the
 * pattern in `@/modules/accounting/data/aging-repo.ts`. `branches`,
 * `raw_materials`, `products` and `users` ARE read through the `admin` module's
 * repos — the single source of truth for that master data.
 *
 * Bounds (documented, not configurable — this stays a bounded read, never an
 * unbounded scan, per `IMPLEMENTATION_PLAN.md` §4.2 "live ledgers, not cached
 * aggregates"):
 *  - `sales_invoices`: Submitted only, newest first, capped at
 *    {@link INVOICE_SCAN_CAP} rows, additionally bounded to the trailing
 *    `months` window (default {@link DEFAULT_MONTHS}) so the read shrinks with
 *    a narrower dashboard range instead of always scanning the full cap.
 *  - `approval_requests`: `state: 'pending'` only, oldest first, capped at
 *    {@link PENDING_APPROVAL_CAP} rows.
 *  - `branches` / `products` / `raw_materials` / `users`: one page of up to
 *    {@link REFERENCE_LIST_PAGE_SIZE} rows each — reference/master data, not
 *    expected to exceed this in practice.
 *  - `bin_balances`: looked up only for the raw-material ids fetched above,
 *    `product_id IN (...)` chunked at {@link RAW_MATERIAL_ID_CHUNK} ids per
 *    query (Appwrite's practical `Query.equal` IN-list size), each chunk
 *    capped at {@link BIN_BALANCE_CAP} rows.
 *
 * Contract (`claude.md` B.5): catch every raw Appwrite error → typed
 * `AppError`; Zod-parse every row; return `Result<T, AppError>`.
 */
import { z } from 'zod'

import { DocStatus } from '@/core/doc-status'
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'
import {
  branchesRepo,
  productsRepo,
  rawMaterialsRepo,
  usersRepo,
  type Branch,
  type Product,
  type RawMaterial,
  type User,
} from '@/modules/admin'

import type { PendingApprovalLike } from '../domain/approvals-sla'
import type { InvoiceLineLike } from '../domain/sales-performance'

const SHAPE_ERROR = 'تعذّر قراءة بيانات لوحة التقارير — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

const DEFAULT_MONTHS = 6
const INVOICE_PAGE_SIZE = 100
const INVOICE_SCAN_CAP = 500
const PENDING_APPROVAL_PAGE_SIZE = 100
const PENDING_APPROVAL_CAP = 500
const REFERENCE_LIST_PAGE_SIZE = 500
const RAW_MATERIAL_ID_CHUNK = 100
const BIN_BALANCE_PAGE_SIZE = 100
const BIN_BALANCE_CAP = 1_000

// ---------------------------------------------------------------------------
// Local minimal projections — this module doesn't own `sales_invoices` or
// `bin_balances`, so (like `accounting/data/aging-repo.ts`) it parses only the
// columns it needs rather than importing another business module's schemas.
// ---------------------------------------------------------------------------

const invoiceForReportsRowSchema = z.object({
  $id: z.string(),
  reference_id: z.string(),
  customer_id: z.string(),
  rep_user_id: z.string(),
  branch_id: z.string().nullish(),
  lines: z.string(),
  net_total: z.number(),
  posting_datetime: z.string(),
})

const invoiceLineSchema = z.object({
  product_id: z.string(),
  qty: z.number(),
  net_price: z.number(),
})

const pendingApprovalRowSchema = z.object({
  $id: z.string(),
  entity_ref: z.string(),
  created_at: z.string(),
})

const binBalanceRowSchema = z.object({
  product_id: z.string(),
  qty: z.number(),
})

export interface DashboardInvoiceRow {
  $id: string
  reference_id: string
  customer_id: string
  rep_user_id: string
  branch_id: string | null
  net_total: number
  posting_datetime: string
  lines: InvoiceLineLike[]
}

export interface DashboardData {
  /** Recent Submitted `sales_invoices`, lines already parsed. See bounds above. */
  invoices: DashboardInvoiceRow[]
  branches: Branch[]
  /** Every staff profile — used to resolve `rep_user_id` to a display name. */
  users: User[]
  products: Product[]
  rawMaterials: RawMaterial[]
  /** Summed `bin_balances.qty` per raw-material id, across every warehouse. */
  onHandByMaterial: Map<string, number>
  pendingApprovals: PendingApprovalLike[]
}

function monthsAgoIso(months: number): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1)).toISOString()
}

/** Paginate `tableId` under `baseQueries` up to `cap` rows, parsing every row. */
async function scanRows<T>(
  tableId: string,
  baseQueries: readonly string[],
  pageSize: number,
  cap: number,
  parse: (raw: unknown) => Result<T>,
): Promise<Result<T[]>> {
  const collected: T[] = []
  try {
    for (let offset = 0; offset < cap; offset += pageSize) {
      const res = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId,
        queries: [...baseQueries, Query.limit(pageSize), Query.offset(offset)],
      })
      for (const raw of res.rows) {
        const parsed = parse(raw)
        if (!parsed.ok) return parsed
        collected.push(parsed.value)
      }
      if (res.rows.length < pageSize) break
    }
    return ok(collected)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

function parseInvoiceLines(raw: string): Result<InvoiceLineLike[]> {
  const trimmed = raw.trim()
  if (trimmed === '') return ok([])
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return err(appError('server', SHAPE_ERROR, { detail: 'sales_invoices.lines: malformed JSON' }))
  }
  const result = z.array(invoiceLineSchema).safeParse(parsed)
  if (!result.success) {
    return err(appError('server', SHAPE_ERROR, { detail: result.error.message }))
  }
  return ok(result.data)
}

function parseInvoiceRow(raw: unknown): Result<DashboardInvoiceRow> {
  const row = invoiceForReportsRowSchema.safeParse(raw)
  if (!row.success) return err(appError('server', SHAPE_ERROR, { detail: row.error.message }))
  const linesRes = parseInvoiceLines(row.data.lines)
  if (!linesRes.ok) return linesRes
  return ok({
    $id: row.data.$id,
    reference_id: row.data.reference_id,
    customer_id: row.data.customer_id,
    rep_user_id: row.data.rep_user_id,
    branch_id: row.data.branch_id ?? null,
    net_total: row.data.net_total,
    posting_datetime: row.data.posting_datetime,
    lines: linesRes.value,
  })
}

function parsePendingApproval(raw: unknown): Result<PendingApprovalLike> {
  const parsed = pendingApprovalRowSchema.safeParse(raw)
  if (!parsed.success) return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
  return ok(parsed.data)
}

function parseBinBalance(raw: unknown): Result<{ product_id: string; qty: number }> {
  const parsed = binBalanceRowSchema.safeParse(raw)
  if (!parsed.success) return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
  return ok(parsed.data)
}

function fetchInvoices(months: number): Promise<Result<DashboardInvoiceRow[]>> {
  return scanRows(
    Tables.salesInvoices,
    [
      Query.equal('doc_status', DocStatus.Submitted),
      Query.greaterThanEqual('posting_datetime', monthsAgoIso(months)),
      Query.orderDesc('posting_datetime'),
    ],
    INVOICE_PAGE_SIZE,
    INVOICE_SCAN_CAP,
    parseInvoiceRow,
  )
}

function fetchPendingApprovals(): Promise<Result<PendingApprovalLike[]>> {
  return scanRows(
    Tables.approvalRequests,
    [Query.equal('state', 'pending'), Query.orderAsc('created_at')],
    PENDING_APPROVAL_PAGE_SIZE,
    PENDING_APPROVAL_CAP,
    parsePendingApproval,
  )
}

async function fetchOnHandByMaterial(
  rawMaterialIds: readonly string[],
): Promise<Result<Map<string, number>>> {
  const onHand = new Map<string, number>()
  for (let i = 0; i < rawMaterialIds.length; i += RAW_MATERIAL_ID_CHUNK) {
    const chunk = rawMaterialIds.slice(i, i + RAW_MATERIAL_ID_CHUNK)
    const res = await scanRows(
      Tables.binBalances,
      [Query.equal('product_id', chunk as string[])],
      BIN_BALANCE_PAGE_SIZE,
      BIN_BALANCE_CAP,
      parseBinBalance,
    )
    if (!res.ok) return res
    for (const row of res.value) {
      onHand.set(row.product_id, (onHand.get(row.product_id) ?? 0) + row.qty)
    }
  }
  return ok(onHand)
}

export interface FetchDashboardDataParams {
  /** Trailing months of `sales_invoices` history to read. Default {@link DEFAULT_MONTHS}. */
  months?: number
  /**
   * Accepted for call-signature symmetry with `useDashboard`, which threads
   * the same params object into the domain layer's `slaBreaches(pending,
   * slaHours)`. The query here doesn't change with it — every pending
   * `approval_requests` row is fetched and the domain layer does the age
   * filtering.
   */
  slaHours?: number
}

export async function fetchDashboardData(
  params: FetchDashboardDataParams = {},
): Promise<Result<DashboardData>> {
  const months = params.months ?? DEFAULT_MONTHS

  const [invoicesRes, branchesRes, usersRes, productsRes, rawMaterialsRes, pendingRes] =
    await Promise.all([
      fetchInvoices(months),
      branchesRepo.list({ page: 0, pageSize: REFERENCE_LIST_PAGE_SIZE, sort: { field: 'name', dir: 'asc' } }),
      usersRepo.list({
        page: 0,
        pageSize: REFERENCE_LIST_PAGE_SIZE,
        sort: { field: 'full_name', dir: 'asc' },
      }),
      productsRepo.list({ page: 0, pageSize: REFERENCE_LIST_PAGE_SIZE, sort: { field: 'name', dir: 'asc' } }),
      rawMaterialsRepo.list({
        page: 0,
        pageSize: REFERENCE_LIST_PAGE_SIZE,
        sort: { field: 'name', dir: 'asc' },
      }),
      fetchPendingApprovals(),
    ])

  if (!invoicesRes.ok) return invoicesRes
  if (!branchesRes.ok) return branchesRes
  if (!usersRes.ok) return usersRes
  if (!productsRes.ok) return productsRes
  if (!rawMaterialsRes.ok) return rawMaterialsRes
  if (!pendingRes.ok) return pendingRes

  const rawMaterialIds = rawMaterialsRes.value.rows.map((m) => m.$id)
  const onHandRes = await fetchOnHandByMaterial(rawMaterialIds)
  if (!onHandRes.ok) return onHandRes

  return ok({
    invoices: invoicesRes.value,
    branches: branchesRes.value.rows,
    users: usersRes.value.rows,
    products: productsRes.value.rows,
    rawMaterials: rawMaterialsRes.value.rows,
    onHandByMaterial: onHandRes.value,
    pendingApprovals: pendingRes.value,
  })
}
