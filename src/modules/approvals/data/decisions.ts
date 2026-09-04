/**
 * Data-layer wrappers around the `/evaluate-approval` and `/decide-approval`
 * server routes (`src/infrastructure/appwrite/functions.ts`). Presentation
 * code calls these instead of reaching into the infrastructure layer directly
 * (`claude.md` — layers stay separated).
 */
import {
  decideApprovalRequest as callDecideApprovalRequest,
  evaluateApproval as callEvaluateApproval,
  type DecideApprovalPayload,
  type DecideApprovalResult,
  type EvaluateApprovalPayload,
  type EvaluateApprovalResult,
} from '@/infrastructure/appwrite/functions'
import type { Result } from '@/core/result'

export type {
  DecideApprovalPayload,
  DecideApprovalResult,
  EvaluateApprovalPayload,
  EvaluateApprovalResult,
}

/**
 * Run the tiered approval engine for one movement. Idempotent per
 * `payload.entityRef` — a second call for the same movement replays the first
 * decision instead of evaluating twice.
 */
export function evaluateApproval(
  payload: EvaluateApprovalPayload,
): Promise<Result<EvaluateApprovalResult>> {
  return callEvaluateApproval(payload)
}

/**
 * Resolve a `pending` approval request as approved or rejected. The server is
 * authoritative on segregation of duties (the decider may not be the original
 * requester) and on the request still being `pending`.
 */
export function decideApprovalRequest(
  payload: DecideApprovalPayload,
): Promise<Result<DecideApprovalResult>> {
  return callDecideApprovalRequest(payload)
}
