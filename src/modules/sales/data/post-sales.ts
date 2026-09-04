/**
 * Post submitted sales documents into the immutable ledgers via `shield-server`.
 * The client never writes a ledger row directly.
 *
 * ## Idempotency
 * Every posting is keyed by the document's `reference_id` (`voucher_no`). The
 * server returns a `409` (mapped to `AppError.code === 'conflict'`) when that
 * voucher was already posted; these helpers treat that as a benign
 * "already posted" result rather than a user-facing error, so a retry
 * (double-click, refetch-then-post, a resumed flow) is a no-op.
 *
 * ### The invoice two-step
 * A sales invoice posts to TWO ledgers — stock, then GL — under the same
 * `voucher_no`. They are posted in order:
 *   1. `postStockLedger` (stock leaves rep custody)
 *   2. `postGl`           (Dr cash/AR, Cr sales)
 * If step 1 comes back `conflict` we still attempt step 2, because the two posts
 * are independent on the server and the GL half may not have landed on an
 * earlier interrupted run. Step 2 is itself idempotent, so a fully-posted
 * invoice re-run resolves to `{ stockAlreadyPosted: true, glAlreadyPosted: true }`.
 */
import { err, ok, type Result } from '@/core/result'
import {
  postGl,
  postStockLedger,
  type PostGlResult,
  type PostStockLedgerResult,
} from '@/infrastructure/appwrite/functions'

import { invoiceToGlLines, invoiceToStockMoves, repIssueToStockMoves } from '../domain/to-ledger'
import type { RepStockIssueRow, SalesInvoiceRow } from '../domain/schemas'

const INVOICE_VOUCHER_TYPE = 'SalesInvoice'
const REP_ISSUE_VOUCHER_TYPE = 'RepStockIssue'

export interface InvoiceLedgerPosting {
  voucherNo: string
  stockAlreadyPosted: boolean
  glAlreadyPosted: boolean
  /** Fresh stock-post result, or `null` when it was already posted. */
  stock: PostStockLedgerResult | null
  /** Fresh GL-post result, or `null` when it was already posted. */
  gl: PostGlResult | null
}

export async function postInvoiceToLedger(
  invoice: SalesInvoiceRow,
  repCustodyWarehouseId: string,
): Promise<Result<InvoiceLedgerPosting>> {
  const moves = invoiceToStockMoves(invoice, repCustodyWarehouseId)

  const stockRes = await postStockLedger({
    voucherType: INVOICE_VOUCHER_TYPE,
    voucherNo: invoice.reference_id,
    postingDatetime: invoice.posting_datetime,
    moves,
  })
  let stockAlreadyPosted = false
  let stock: PostStockLedgerResult | null = null
  if (stockRes.ok) {
    stock = stockRes.value
  } else if (stockRes.error.code === 'conflict') {
    stockAlreadyPosted = true
  } else {
    return err(stockRes.error)
  }

  const glRes = await postGl({
    voucherType: INVOICE_VOUCHER_TYPE,
    voucherNo: invoice.reference_id,
    postingDatetime: invoice.posting_datetime,
    branchId: invoice.branch_id ?? null,
    lines: invoiceToGlLines(invoice),
  })
  let glAlreadyPosted = false
  let gl: PostGlResult | null = null
  if (glRes.ok) {
    gl = glRes.value
  } else if (glRes.error.code === 'conflict') {
    glAlreadyPosted = true
  } else {
    return err(glRes.error)
  }

  return ok({ voucherNo: invoice.reference_id, stockAlreadyPosted, glAlreadyPosted, stock, gl })
}

export interface RepIssueWarehouses {
  fromSubWarehouseId: string
  repCustodyWarehouseId: string
}

export interface RepIssueLedgerPosting {
  voucherNo: string
  alreadyPosted: boolean
  posted: PostStockLedgerResult | null
}

export async function postRepIssueToLedger(
  issue: RepStockIssueRow,
  warehouses: RepIssueWarehouses,
): Promise<Result<RepIssueLedgerPosting>> {
  const moves = repIssueToStockMoves(
    issue,
    warehouses.fromSubWarehouseId,
    warehouses.repCustodyWarehouseId,
  )

  const res = await postStockLedger({
    voucherType: REP_ISSUE_VOUCHER_TYPE,
    voucherNo: issue.reference_id,
    postingDatetime: issue.posting_datetime,
    moves,
  })

  if (res.ok) return ok({ voucherNo: issue.reference_id, alreadyPosted: false, posted: res.value })
  if (res.error.code === 'conflict') {
    return ok({ voucherNo: issue.reference_id, alreadyPosted: true, posted: null })
  }
  return err(res.error)
}
