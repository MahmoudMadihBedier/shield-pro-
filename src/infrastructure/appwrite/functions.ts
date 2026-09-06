/**
 * Data layer for the server-side logic that owns document identity and
 * lifecycle. The client never allocates a sequence or flips `doc_status`
 * itself — it calls a Postgres `SECURITY DEFINER` function (`supabase.rpc`), or
 * an Edge Function for the few operations that need the auth admin API, and
 * gets a `Result` back.
 *
 * `ServerRoute` keys are retained as stable identifiers; `DISPATCH` binds each
 * to its RPC / Edge Function name and argument shape.
 */
import type { ApprovalAction, ApprovalContext } from '@/core/approval'
import { appError, type AppError } from '@/core/errors'
import type { FraudCandidate } from '@/core/fraud'
import type { GlLine } from '@/core/ledger'
import type { ReferenceEntity } from '@/core/reference-id'
import { err, ok, type Result } from '@/core/result'

import { supabase } from './client'
import { mapAppwriteError } from './errors'

export const ServerRoute = {
  allocateReferenceId: '/allocate-reference-id',
  submitDocument: '/submit-document',
  cancelDocument: '/cancel-document',
  postStockLedger: '/post-stock-ledger',
  postGl: '/post-gl',
  segregationGuard: '/segregation-guard',
  fraudScan: '/fraud-scan',
  reviewFraudFlag: '/review-fraud-flag',
  evaluateApproval: '/evaluate-approval',
  decideApproval: '/decide-approval',
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

export interface FraudScanPayload {
  /** Hours to look back over; server default 24, capped at 168 (7 days). */
  lookbackHours?: number
}

export interface FraudScanResult {
  scanned: { moves: number; auditEvents: number }
  flagsCreated: number
  flags: FraudCandidate[]
}

export interface ReviewFraudFlagPayload {
  flagId: string
  status: 'reviewed' | 'dismissed'
}

export interface ReviewFraudFlagResult {
  id: string
  status: string
}

export interface EvaluateApprovalPayload {
  movementType: string
  entityRef: string
  context: Omit<ApprovalContext, 'movementType' | 'entityRef' | 'actorId'>
}

export interface EvaluateApprovalResult {
  action: ApprovalAction
  /** The `approval_rules` row that decided this, or `null` on the fail-safe default. */
  ruleId: string | null
  approvalRequestId: string
}

export interface DecideApprovalPayload {
  approvalRequestId: string
  decision: 'approved' | 'rejected'
  reason?: string
}

export interface DecideApprovalResult {
  $id: string
  entityType: string
  entityRef: string
  branchId: string | null
  requestedBy: string
  state: 'approved' | 'rejected'
  decidedBy: string
  decisionReason: string | null
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

/* eslint-disable @typescript-eslint/no-explicit-any */
type Dispatch =
  | { kind: 'rpc'; fn: string; args: (p: any) => Record<string, unknown> }
  | { kind: 'edge'; fn: string; body: (p: any) => Record<string, unknown> }

/** Bind each logical route to a Postgres RPC or an Edge Function. */
const DISPATCH: Record<string, Dispatch> = {
  [ServerRoute.allocateReferenceId]: {
    kind: 'rpc',
    fn: 'allocate_reference_id',
    args: (p) => ({ p_entity: p.entity }),
  },
  [ServerRoute.submitDocument]: {
    kind: 'rpc',
    fn: 'submit_document',
    args: (p) => ({ p_table: p.table, p_row_id: p.rowId }),
  },
  [ServerRoute.cancelDocument]: {
    kind: 'rpc',
    fn: 'cancel_document',
    args: (p) => ({ p_table: p.table, p_row_id: p.rowId, p_reason: p.reason }),
  },
  [ServerRoute.postStockLedger]: {
    kind: 'rpc',
    fn: 'post_stock_ledger',
    args: (p) => ({ p_payload: p }),
  },
  [ServerRoute.postGl]: { kind: 'rpc', fn: 'post_gl', args: (p) => ({ p_payload: p }) },
  [ServerRoute.segregationGuard]: {
    kind: 'rpc',
    fn: 'segregation_guard',
    args: (p) => ({ p_table: p.table, p_row_id: p.rowId }),
  },
  [ServerRoute.fraudScan]: {
    kind: 'rpc',
    fn: 'fraud_scan',
    args: (p) => ({ p_lookback_hours: p.lookbackHours ?? null }),
  },
  [ServerRoute.reviewFraudFlag]: {
    kind: 'rpc',
    fn: 'review_fraud_flag',
    args: (p) => ({ p_flag_id: p.flagId, p_status: p.status }),
  },
  [ServerRoute.evaluateApproval]: {
    kind: 'rpc',
    fn: 'evaluate_approval',
    args: (p) => ({ p_payload: p }),
  },
  [ServerRoute.decideApproval]: {
    kind: 'rpc',
    fn: 'decide_approval',
    args: (p) => ({
      p_request_id: p.approvalRequestId,
      p_decision: p.decision,
      p_reason: p.reason ?? null,
    }),
  },
  [ServerRoute.createPortalAccount]: {
    kind: 'edge',
    fn: 'portal-account',
    body: (p) => ({ action: 'create', customerId: p.customerId }),
  },
  [ServerRoute.resetPortalPin]: {
    kind: 'edge',
    fn: 'portal-account',
    body: (p) => ({ action: 'reset', customerId: p.customerId }),
  },
  [ServerRoute.revokePortalAccess]: {
    kind: 'edge',
    fn: 'portal-account',
    body: (p) => ({ action: 'revoke', customerId: p.customerId }),
  },
  [ServerRoute.portalMe]: { kind: 'rpc', fn: 'portal_me', args: () => ({}) },
  [ServerRoute.portalInvoices]: {
    kind: 'rpc',
    fn: 'portal_invoices',
    args: (p) => ({ p_page: p.page ?? 0, p_page_size: p.pageSize ?? null }),
  },
  [ServerRoute.portalInvoiceDetail]: {
    kind: 'rpc',
    fn: 'portal_invoice_detail',
    args: (p) => ({ p_invoice_id: p.invoiceId }),
  },
  [ServerRoute.portalReceipts]: {
    kind: 'rpc',
    fn: 'portal_receipts',
    args: (p) => ({ p_page: p.page ?? 0, p_page_size: p.pageSize ?? null }),
  },
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function invoke<T>(path: string, payload: unknown): Promise<Result<T>> {
  const d = DISPATCH[path]
  if (!d) {
    return err(appError('unknown', 'This operation is not available.', { detail: `no binding: ${path}` }))
  }
  try {
    if (d.kind === 'rpc') {
      const { data, error } = await supabase.rpc(d.fn, d.args(payload ?? {}))
      if (error) return err(mapAppwriteError(error))
      return ok(data as T)
    }
    const { data, error } = await supabase.functions.invoke(d.fn, { body: d.body(payload ?? {}) })
    if (error) return err(mapAppwriteError(error))
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error) {
      return err(
        appError('server', String((data as { error: unknown }).error) || 'The operation failed.'),
      )
    }
    return ok(data as T)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
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

/**
 * Run the fraud-detection heuristics over a recent window and persist any new
 * `fraud_flags` rows. Read-mostly for the caller: existing open flags are
 * de-duplicated server-side, so a re-run never creates a duplicate.
 */
export function fraudScan(payload: FraudScanPayload = {}): Promise<Result<FraudScanResult>> {
  return invoke<FraudScanResult>(ServerRoute.fraudScan, payload)
}

/** Resolve one `fraud_flags` row as reviewed or dismissed; only an `open` flag may transition. */
export function reviewFraudFlag(
  payload: ReviewFraudFlagPayload,
): Promise<Result<ReviewFraudFlagResult>> {
  return invoke<ReviewFraudFlagResult>(ServerRoute.reviewFraudFlag, payload)
}

/**
 * Run the tiered approval engine for one movement (`src/core/approval.ts`).
 * Idempotent per `entityRef` — calling this again for the same movement
 * replays the first decision rather than evaluating twice.
 */
export function evaluateApproval(
  payload: EvaluateApprovalPayload,
): Promise<Result<EvaluateApprovalResult>> {
  return invoke<EvaluateApprovalResult>(ServerRoute.evaluateApproval, payload)
}

/**
 * Resolve a `pending` approval request as approved or rejected. The server
 * re-checks that the decider isn't the original requester (segregation of
 * duties) and that the request is still `pending`.
 */
export function decideApprovalRequest(
  payload: DecideApprovalPayload,
): Promise<Result<DecideApprovalResult>> {
  return invoke<DecideApprovalResult>(ServerRoute.decideApproval, payload)
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
