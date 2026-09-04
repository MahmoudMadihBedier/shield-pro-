/**
 * Data layer for `shield-server`, the single Appwrite Function that owns
 * document identity and lifecycle. The client never allocates a sequence or
 * flips `doc_status` itself — it calls a route on this Function and gets a
 * `Result` back.
 *
 * Each operation is a URL path on the one Function (see `functions/server`).
 * Wire envelope (`functions/common/handler.ts`):
 *   success → `{ ok: true,  data: <payload> }`
 *   failure → `{ ok: false, error: { code, message } }`
 */
import { ExecutionMethod } from 'appwrite'

import { appError, type AppError, type AppErrorCode } from '@/core/errors'
import type { GlLine } from '@/core/ledger'
import type { ReferenceEntity } from '@/core/reference-id'
import { err, ok, type Result } from '@/core/result'

import { mapAppwriteError } from './errors'
import { functions } from './services'

export const SERVER_FUNCTION_ID = 'shield-server'

export const ServerRoute = {
  allocateReferenceId: '/allocate-reference-id',
  submitDocument: '/submit-document',
  cancelDocument: '/cancel-document',
  postStockLedger: '/post-stock-ledger',
  postGl: '/post-gl',
  segregationGuard: '/segregation-guard',
  // CRM client portal (Phase 3) — see `functions/routes/portal-account.ts` and
  // `functions/routes/portal-data.ts`.
  createPortalAccount: '/portal-account/create',
  resetPortalPin: '/portal-account/reset',
  revokePortalAccess: '/portal-account/revoke',
  portalMe: '/portal/me',
  portalInvoices: '/portal/invoices',
  portalInvoiceDetail: '/portal/invoice-detail',
  portalReceipts: '/portal/receipts',
} as const

export interface AllocatedReference {
  referenceId: string
  prefix: string
  year: number
  sequence: number
}

export interface DocumentTransition {
  table: string
  rowId: string
  referenceId: string
  docStatus: number
  postingDatetime?: string
}

export interface StockMoveInput {
  productId: string
  warehouseId: string
  lotNumber?: string | null
  qtyChange: number
  valuationRate?: number
}

export interface PostStockLedgerPayload {
  voucherType: string
  voucherNo: string
  postingDatetime: string
  moves: StockMoveInput[]
}

export interface PostStockLedgerResult {
  voucherNo: string
  entries: number
  balances: Array<{ productId: string; warehouseId: string; qtyAfter: number }>
}

export interface PostGlPayload {
  voucherType: string
  voucherNo: string
  postingDatetime: string
  branchId?: string | null
  lines: GlLine[]
}

export interface PostGlResult {
  voucherNo: string
  entries: number
}

export interface SegregationCheckResult {
  /** Ids of the violated SoD rules (`src/core/segregation.ts`); empty === clean. */
  violated: string[]
  clean: boolean
}

// --- CRM client portal (Phase 3) -------------------------------------------

export interface CreatePortalAccountPayload {
  customerId: string
}
export interface CreatePortalAccountResult {
  portalUserId: string
  /** Shown to the admin exactly once — never persisted anywhere. */
  pin: string
}

export interface ResetPortalPinPayload {
  customerId: string
}
export interface ResetPortalPinResult {
  /** Shown to the admin exactly once — never persisted anywhere. */
  pin: string
}

export interface RevokePortalAccessPayload {
  customerId: string
}
export interface RevokePortalAccessResult {
  revoked: true
}

export interface PortalMeResult {
  customerId: string
  code: string
  name: string
  phone: string | null
  branchId: string | null
}

export interface PortalInvoiceListPayload {
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
export interface PortalInvoiceListResult {
  rows: PortalInvoiceListItem[]
  total: number
}

export interface PortalInvoiceDetailPayload {
  invoiceId: string
}
export interface PortalInvoiceDetailResult {
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

export interface PortalReceiptListPayload {
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
export interface PortalReceiptListResult {
  rows: PortalReceiptListItem[]
  total: number
}

const KNOWN_CODES: ReadonlySet<AppErrorCode> = new Set<AppErrorCode>([
  'network',
  'unauthorized',
  'forbidden',
  'not_found',
  'validation',
  'conflict',
  'rate_limited',
  'server',
  'unknown',
])

function toAppErrorCode(code: unknown): AppErrorCode {
  return typeof code === 'string' && KNOWN_CODES.has(code as AppErrorCode)
    ? (code as AppErrorCode)
    : 'unknown'
}

interface WireFailure {
  ok: false
  error: { code?: string; message?: string }
}
interface WireSuccess<T> {
  ok: true
  data: T
}

async function invoke<T>(path: string, payload: unknown): Promise<Result<T>> {
  let body: string
  try {
    const execution = await functions.createExecution({
      functionId: SERVER_FUNCTION_ID,
      body: JSON.stringify(payload),
      method: ExecutionMethod.POST,
      xpath: path,
      headers: { 'content-type': 'application/json' },
    })
    body = execution.responseBody
  } catch (e) {
    return err(mapAppwriteError(e))
  }

  let parsed: WireSuccess<T> | WireFailure
  try {
    parsed = JSON.parse(body || '{}') as WireSuccess<T> | WireFailure
  } catch {
    return err(
      appError('server', 'The server returned an unreadable response. Please try again.', {
        detail: body.slice(0, 500),
      }),
    )
  }

  if (!parsed || typeof parsed !== 'object' || !('ok' in parsed)) {
    return err(appError('server', 'The server returned an unexpected response. Please try again.'))
  }
  if (parsed.ok) return ok(parsed.data)

  const message = parsed.error?.message ?? 'The operation could not be completed. Please try again.'
  return err(appError(toAppErrorCode(parsed.error?.code), message))
}

/** Reserve the next gap-free `<PREFIX>-<YYYY>-<00000>` for an entity. */
export function allocateReferenceId(entity: ReferenceEntity): Promise<Result<AllocatedReference>> {
  return invoke<AllocatedReference>(ServerRoute.allocateReferenceId, { entity })
}

/** Draft → Submitted for `<table>/<rowId>`. */
export function submitDocument(table: string, rowId: string): Promise<Result<DocumentTransition>> {
  return invoke<DocumentTransition>(ServerRoute.submitDocument, { table, rowId })
}

/** Submitted → Cancelled for `<table>/<rowId>`; `reason` is mandatory. */
export function cancelDocument(
  table: string,
  rowId: string,
  reason: string,
): Promise<Result<DocumentTransition>> {
  return invoke<DocumentTransition>(ServerRoute.cancelDocument, { table, rowId, reason })
}

/**
 * Post an immutable batch of stock-ledger entries for one voucher and refresh the
 * affected `bin_balances`. The server rejects a voucher that was already posted.
 */
export function postStockLedger(
  payload: PostStockLedgerPayload,
): Promise<Result<PostStockLedgerResult>> {
  return invoke<PostStockLedgerResult>(ServerRoute.postStockLedger, payload)
}

/**
 * Post a balanced double-entry batch of GL rows for one voucher. The server
 * re-checks `Σ debit === Σ credit` and rejects a voucher that was already posted.
 */
export function postGl(payload: PostGlPayload): Promise<Result<PostGlResult>> {
  return invoke<PostGlResult>(ServerRoute.postGl, payload)
}

/**
 * Read-only pre-check for the Submit button: does `<table>/<rowId>` currently
 * break a segregation-of-duties rule? The authoritative check still runs inside
 * `submitDocument` / `cancelDocument`.
 */
export function checkSegregation(
  table: string,
  rowId: string,
): Promise<Result<SegregationCheckResult>> {
  return invoke<SegregationCheckResult>(ServerRoute.segregationGuard, { table, rowId })
}

// --- CRM client portal (Phase 3) -------------------------------------------

/** Staff-only: create a customer's CRM portal Auth account, returning its one-time PIN. */
export function createPortalAccount(
  payload: CreatePortalAccountPayload,
): Promise<Result<CreatePortalAccountResult>> {
  return invoke<CreatePortalAccountResult>(ServerRoute.createPortalAccount, payload)
}

/** Staff-only: reset a customer's portal PIN, returning the new one-time PIN. */
export function resetPortalPin(
  payload: ResetPortalPinPayload,
): Promise<Result<ResetPortalPinResult>> {
  return invoke<ResetPortalPinResult>(ServerRoute.resetPortalPin, payload)
}

/** Staff-only: block logins and kill any live session for a customer's portal account. */
export function revokePortalAccess(
  payload: RevokePortalAccessPayload,
): Promise<Result<RevokePortalAccessResult>> {
  return invoke<RevokePortalAccessResult>(ServerRoute.revokePortalAccess, payload)
}

/** Portal-only: the signed-in customer's own profile. */
export function getPortalMe(): Promise<Result<PortalMeResult>> {
  return invoke<PortalMeResult>(ServerRoute.portalMe, {})
}

/** Portal-only: the signed-in customer's own invoices, paginated. */
export function listPortalInvoices(
  payload: PortalInvoiceListPayload = {},
): Promise<Result<PortalInvoiceListResult>> {
  return invoke<PortalInvoiceListResult>(ServerRoute.portalInvoices, payload)
}

/** Portal-only: one of the signed-in customer's own invoices, in full. */
export function getPortalInvoiceDetail(
  payload: PortalInvoiceDetailPayload,
): Promise<Result<PortalInvoiceDetailResult>> {
  return invoke<PortalInvoiceDetailResult>(ServerRoute.portalInvoiceDetail, payload)
}

/** Portal-only: the signed-in customer's own receipts, paginated. */
export function listPortalReceipts(
  payload: PortalReceiptListPayload = {},
): Promise<Result<PortalReceiptListResult>> {
  return invoke<PortalReceiptListResult>(ServerRoute.portalReceipts, payload)
}

export type { AppError }
