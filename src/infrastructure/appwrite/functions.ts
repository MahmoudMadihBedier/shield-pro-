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

import type { ApprovalAction, ApprovalContext } from '@/core/approval'
import { appError, type AppError, type AppErrorCode } from '@/core/errors'
import type { FraudCandidate } from '@/core/fraud'
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
  fraudScan: '/fraud-scan',
  reviewFraudFlag: '/review-fraud-flag',
  evaluateApproval: '/evaluate-approval',
  decideApproval: '/decide-approval',
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

export type { AppError }
