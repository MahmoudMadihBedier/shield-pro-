/**
 * Read repository behind the customer-aging report (Story 2.5).
 *
 * It reads three tables and hands the raw rows to the pure `customerAging`
 * reducer:
 *  - `sales_invoices` via a thin local reader — the `accounting` module must
 *    NOT import `@/modules/sales` (built in parallel), so it parses only the
 *    columns it needs with `invoiceForAgingSchema`.
 *  - `receipts` via a thin local reader (Submitted only).
 *  - `customers` via `customersRepo` from `@/modules/admin` (single source of
 *    truth) — for the display name and `credit_limit`.
 *
 * Contract (`claude.md` B.5): typed `AppError`, Zod-parsed rows, `Result`.
 */
import { DocStatus } from '@/core/doc-status'
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { fetchCustomerAging } from '@/infrastructure/appwrite/functions'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'

import { type CustomerAging } from '../domain/aging'
import {
  invoiceForAgingSchema,
  receiptRowSchema,
  type InvoiceForAging,
  type Receipt,
} from '../domain/schemas'

const SHAPE_ERROR = 'تعذّر قراءة بيانات أعمار الديون — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

const SCAN_CAP = 5_000
const SCAN_PAGE = 100

interface InvoiceQuery {
  customerId?: string
  from?: string
  to?: string
}

function invoiceQueries(params: InvoiceQuery): string[] {
  const queries: string[] = [Query.equal('doc_status', DocStatus.Submitted)]
  if (params.customerId) queries.push(Query.equal('customer_id', params.customerId))
  if (params.from) queries.push(Query.greaterThanEqual('posting_datetime', params.from))
  if (params.to) queries.push(Query.lessThanEqual('posting_datetime', params.to))
  return queries
}

async function scanTable<T>(
  tableId: string,
  baseQueries: string[],
  parse: (raw: unknown) => { success: true; data: T } | { success: false; message: string },
): Promise<Result<T[]>> {
  const collected: T[] = []
  try {
    for (let offset = 0; offset < SCAN_CAP; offset += SCAN_PAGE) {
      const res = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId,
        queries: [
          ...baseQueries,
          Query.orderAsc('posting_datetime'),
          Query.limit(SCAN_PAGE),
          Query.offset(offset),
        ],
      })
      for (const raw of res.rows) {
        const parsed = parse(raw)
        if (!parsed.success) return err(appError('server', SHAPE_ERROR, { detail: parsed.message }))
        collected.push(parsed.data)
      }
      if (res.rows.length < SCAN_PAGE) break
    }
    return ok(collected)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

const parseInvoice = (raw: unknown) => {
  const r = invoiceForAgingSchema.safeParse(raw)
  return r.success
    ? { success: true as const, data: r.data }
    : { success: false as const, message: r.error.message }
}

const parseReceipt = (raw: unknown) => {
  const r = receiptRowSchema.safeParse(raw)
  return r.success
    ? { success: true as const, data: r.data }
    : { success: false as const, message: r.error.message }
}

/** Submitted `sales_invoices`, projected to the columns aging reads. */
export function listSubmittedInvoices(
  params: InvoiceQuery = {},
): Promise<Result<InvoiceForAging[]>> {
  return scanTable(Tables.salesInvoices, invoiceQueries(params), parseInvoice)
}

/** Submitted `receipts` for one customer. */
export function listReceiptsForCustomer(customerId: string): Promise<Result<Receipt[]>> {
  return scanTable(
    Tables.receipts,
    [Query.equal('doc_status', DocStatus.Submitted), Query.equal('customer_id', customerId)],
    parseReceipt,
  )
}

/** One customer's aging enriched with display name and credit limit. */
export interface CustomerAgingRow extends CustomerAging {
  customerName: string
  creditLimit: number
}

/**
 * Whole-book aging as of `asOf`. Aggregated in Postgres (`customer_aging` RPC,
 * migration 0015) over the full ledger — no client-side row cap — and
 * branch-scoped server-side. The pure `customerAging` reducer in
 * `../domain/aging` stays the tested specification.
 */
export async function customerAgingReport(asOf: Date): Promise<Result<CustomerAgingRow[]>> {
  const res = await fetchCustomerAging(asOf.toISOString())
  if (!res.ok) return res
  return ok(
    res.value.map((r) => ({
      customerId: r.customerId,
      customerName: r.customerName,
      outstanding: r.outstanding,
      creditLimit: r.creditLimit,
      buckets: r.buckets,
      oldestDays: r.oldestDays,
    })),
  )
}
