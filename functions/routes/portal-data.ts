/**
 * Customer-facing CRM portal data routes (Implementation Plan §1 Phase 3).
 *
 * Every export here starts with `requireCustomerCaller`, which resolves the
 * caller's OWN `customer_id` server-side from their verified `$id` — never
 * from the request body. Every list is filtered to that id and every detail
 * fetch re-checks row ownership before returning anything. This is the only
 * way a portal session may read `sales_invoices` / `receipts`: the client
 * never gets a raw `tablesDB` handle (see claude.md A.6 / the CRM portal
 * security model in the story brief).
 *
 * Read-only — no writes, no transaction wrapper, no audit rows.
 */
import { Query, type TablesDB } from 'node-appwrite'
import { z } from 'zod'

import { DATABASE_ID } from '../common/appwrite'
import { FnError } from '../common/handler'
import { requireCustomerCaller, type PortalCallerContext } from '../common/portal-caller'

const CUSTOMERS_TABLE = 'customers'
const SALES_INVOICES_TABLE = 'sales_invoices'
const RECEIPTS_TABLE = 'receipts'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

function clampPageSize(pageSize: number | undefined): number {
  if (typeof pageSize !== 'number' || !Number.isFinite(pageSize) || pageSize <= 0) {
    return DEFAULT_PAGE_SIZE
  }
  return Math.min(Math.floor(pageSize), MAX_PAGE_SIZE)
}

function clampPage(page: number | undefined): number {
  if (typeof page !== 'number' || !Number.isFinite(page) || page <= 0) return 0
  return Math.floor(page)
}

function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404
}

function rowsOf(result: unknown): { rows: Record<string, unknown>[]; total: number } {
  if (typeof result !== 'object' || result === null) return { rows: [], total: 0 }
  const r = result as { rows?: unknown; total?: unknown }
  const rows = Array.isArray(r.rows) ? (r.rows as Record<string, unknown>[]) : []
  const total = typeof r.total === 'number' ? r.total : rows.length
  return { rows, total }
}

/** Every exported route starts here: unauthenticated → `unauthorized`, no linked customer → `forbidden`. */
async function requireCaller(
  tablesDB: TablesDB,
  caller: string | null,
): Promise<PortalCallerContext> {
  if (!caller) throw new FnError('unauthorized', 'a signed-in caller is required')
  return requireCustomerCaller(tablesDB, caller)
}

// ---------------------------------------------------------------------------
// getPortalMe
// ---------------------------------------------------------------------------

export interface PortalMe {
  customerId: string
  code: string
  name: string
  phone: string | null
  branchId: string | null
}

export async function getPortalMe(tablesDB: TablesDB, caller: string | null): Promise<PortalMe> {
  const ctx = await requireCaller(tablesDB, caller)

  let row: Record<string, unknown>
  try {
    row = (await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: CUSTOMERS_TABLE,
      rowId: ctx.customerId,
    })) as unknown as Record<string, unknown>
  } catch (e) {
    if (isNotFound(e)) throw new FnError('not_found', 'your linked customer record was not found')
    throw e
  }

  const phone = typeof row.phone === 'string' && row.phone.trim() !== '' ? row.phone : null
  return { customerId: ctx.customerId, code: ctx.code, name: ctx.name, phone, branchId: ctx.branchId }
}

// ---------------------------------------------------------------------------
// listPortalInvoices
// ---------------------------------------------------------------------------

export interface ListPortalInvoicesInput {
  page?: number
  pageSize?: number
}

export interface PortalInvoiceListItem {
  id: string
  referenceId: string
  docStatus: number
  netTotal: number
  paymentMethod: string
  postingDatetime: string
}

export interface PortalInvoiceListOutput {
  rows: PortalInvoiceListItem[]
  total: number
}

const invoiceListRowSchema = z.object({
  reference_id: z.string(),
  doc_status: z.number(),
  net_total: z.number(),
  payment_method: z.string(),
  posting_datetime: z.string(),
})

export async function listPortalInvoices(
  tablesDB: TablesDB,
  input: ListPortalInvoicesInput,
  caller: string | null,
): Promise<PortalInvoiceListOutput> {
  const ctx = await requireCaller(tablesDB, caller)
  const pageSize = clampPageSize(input?.pageSize)
  const page = clampPage(input?.page)

  const found = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: SALES_INVOICES_TABLE,
    queries: [
      Query.equal('customer_id', ctx.customerId),
      Query.orderDesc('posting_datetime'),
      Query.limit(pageSize),
      Query.offset(page * pageSize),
    ],
  })

  const { rows, total } = rowsOf(found)
  const parsedRows = rows.reduce<PortalInvoiceListItem[]>((acc, row) => {
    const parsed = invoiceListRowSchema.safeParse(row)
    const id = typeof row.$id === 'string' ? row.$id : ''
    if (!parsed.success || !id) return acc
    acc.push({
      id,
      referenceId: parsed.data.reference_id,
      docStatus: parsed.data.doc_status,
      netTotal: parsed.data.net_total,
      paymentMethod: parsed.data.payment_method,
      postingDatetime: parsed.data.posting_datetime,
    })
    return acc
  }, [])

  return { rows: parsedRows, total }
}

// ---------------------------------------------------------------------------
// getPortalInvoiceDetail
// ---------------------------------------------------------------------------

export interface GetPortalInvoiceDetailInput {
  invoiceId: string
}

export interface PortalInvoiceDetail {
  id: string
  referenceId: string
  lines: string
  grossTotal: number
  discountTotal: number
  netTotal: number
  paymentMethod: string
  postingDatetime: string
  docStatus: number
}

const invoiceDetailRowSchema = z.object({
  customer_id: z.string(),
  reference_id: z.string(),
  lines: z.string(),
  gross_total: z.number(),
  discount_total: z.number(),
  net_total: z.number(),
  payment_method: z.string(),
  posting_datetime: z.string(),
  doc_status: z.number(),
})

export async function getPortalInvoiceDetail(
  tablesDB: TablesDB,
  input: GetPortalInvoiceDetailInput,
  caller: string | null,
): Promise<PortalInvoiceDetail> {
  const ctx = await requireCaller(tablesDB, caller)
  const invoiceId = String(input?.invoiceId ?? '')
  if (!invoiceId) throw new FnError('validation', 'invoiceId is required')

  let row: Record<string, unknown>
  try {
    row = (await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: SALES_INVOICES_TABLE,
      rowId: invoiceId,
    })) as unknown as Record<string, unknown>
  } catch (e) {
    if (isNotFound(e)) throw new FnError('not_found', `invoice ${invoiceId} does not exist`)
    throw e
  }

  const parsed = invoiceDetailRowSchema.safeParse(row)
  if (!parsed.success) {
    throw new FnError('server', `invoice ${invoiceId} is missing required fields`)
  }

  // The critical ownership check — a portal session may only ever see its own invoices.
  if (parsed.data.customer_id !== ctx.customerId) {
    throw new FnError('forbidden', 'this invoice does not belong to your account')
  }

  const id = typeof row.$id === 'string' ? row.$id : invoiceId
  return {
    id,
    referenceId: parsed.data.reference_id,
    lines: parsed.data.lines,
    grossTotal: parsed.data.gross_total,
    discountTotal: parsed.data.discount_total,
    netTotal: parsed.data.net_total,
    paymentMethod: parsed.data.payment_method,
    postingDatetime: parsed.data.posting_datetime,
    docStatus: parsed.data.doc_status,
  }
}

// ---------------------------------------------------------------------------
// listPortalReceipts
// ---------------------------------------------------------------------------

export interface ListPortalReceiptsInput {
  page?: number
  pageSize?: number
}

export interface PortalReceiptListItem {
  id: string
  invoiceRef: string
  amount: number
  method: string
  postingDatetime: string
  docStatus: number
}

export interface PortalReceiptListOutput {
  rows: PortalReceiptListItem[]
  total: number
}

const receiptListRowSchema = z.object({
  invoice_ref: z.string(),
  amount: z.number(),
  method: z.string(),
  posting_datetime: z.string(),
  doc_status: z.number(),
})

export async function listPortalReceipts(
  tablesDB: TablesDB,
  input: ListPortalReceiptsInput,
  caller: string | null,
): Promise<PortalReceiptListOutput> {
  const ctx = await requireCaller(tablesDB, caller)
  const pageSize = clampPageSize(input?.pageSize)
  const page = clampPage(input?.page)

  const found = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: RECEIPTS_TABLE,
    queries: [
      Query.equal('customer_id', ctx.customerId),
      Query.orderDesc('posting_datetime'),
      Query.limit(pageSize),
      Query.offset(page * pageSize),
    ],
  })

  const { rows, total } = rowsOf(found)
  const parsedRows = rows.reduce<PortalReceiptListItem[]>((acc, row) => {
    const parsed = receiptListRowSchema.safeParse(row)
    const id = typeof row.$id === 'string' ? row.$id : ''
    if (!parsed.success || !id) return acc
    acc.push({
      id,
      invoiceRef: parsed.data.invoice_ref,
      amount: parsed.data.amount,
      method: parsed.data.method,
      postingDatetime: parsed.data.posting_datetime,
      docStatus: parsed.data.doc_status,
    })
    return acc
  }, [])

  return { rows: parsedRows, total }
}
