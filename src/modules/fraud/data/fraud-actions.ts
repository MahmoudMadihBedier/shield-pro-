/**
 * Thin bindings of the `fraud-scan` / `review-fraud-flag` server routes
 * (`src/infrastructure/appwrite/functions.ts`) for this module. Presentation
 * code calls these instead of reaching into `infrastructure` directly
 * (`claude.md` B.3).
 */
import {
  fraudScan,
  reviewFraudFlag as reviewFraudFlagRoute,
  type FraudScanPayload,
  type FraudScanResult,
  type ReviewFraudFlagPayload,
  type ReviewFraudFlagResult,
} from '@/infrastructure/appwrite/functions'
import type { Result } from '@/core/result'

/** Run the fraud heuristics over a recent window and persist any new flags. */
export function runFraudScan(payload: FraudScanPayload = {}): Promise<Result<FraudScanResult>> {
  return fraudScan(payload)
}

/** Resolve one `fraud_flags` row as reviewed or dismissed. */
export function reviewFraudFlag(
  payload: ReviewFraudFlagPayload,
): Promise<Result<ReviewFraudFlagResult>> {
  return reviewFraudFlagRoute(payload)
}

export type { FraudScanPayload, FraudScanResult, ReviewFraudFlagPayload, ReviewFraudFlagResult }
