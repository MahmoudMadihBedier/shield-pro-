/**
 * The `production_requests.status` workflow (`pending → approved → issued`, with
 * `pending → rejected` as the dead end). Mirrors ERPNext's Material Request
 * flow. The enforcing Appwrite Function (segregation of duties, tiered
 * approvals) lands in a later phase — this table is what the UI gates on.
 *
 * `domain` is pure TypeScript — no react, no appwrite imports.
 */
import type { ProductionRequestStatus } from './schemas'

/** The only allowed `status` transitions. */
export const REQUEST_TRANSITIONS: ReadonlyArray<
  readonly [ProductionRequestStatus, ProductionRequestStatus]
> = [
  ['pending', 'approved'],
  ['pending', 'rejected'],
  ['approved', 'issued'],
]

export function canRequestTransition(
  from: ProductionRequestStatus,
  to: ProductionRequestStatus,
): boolean {
  return REQUEST_TRANSITIONS.some(([a, b]) => a === from && b === to)
}
