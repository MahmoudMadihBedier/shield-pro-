/**
 * The return-request approval workflow: a Branch Accountant (or System Admin)
 * approves or rejects a pending request before it may be Submitted
 * (`docs/IMPLEMENTATION_PLAN.md` Phase 2 Story 2.8 — returns own their approval,
 * segregation of duties). `approved` / `rejected` are the only two hops out of
 * `pending`; both are terminal for this workflow field.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import type { ReturnStatus } from './schemas'

/** The only legal `status` hops. */
export const RETURN_TRANSITIONS: ReadonlyArray<readonly [ReturnStatus, ReturnStatus]> = [
  ['pending', 'approved'],
  ['pending', 'rejected'],
]

export function canReturnTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return RETURN_TRANSITIONS.some(([a, b]) => a === from && b === to)
}
