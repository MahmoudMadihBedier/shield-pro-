/**
 * The warehouse-transfer "quadruple step" workflow
 * (`IMPLEMENTATION_PLAN.md` §1 principle 1):
 *
 *   request  → approval → send / auto balance update → receipt confirmation
 *   pending  → approved → executed                   → received
 *
 * `pending` may also be `rejected` (terminal). Each hop is performed by a
 * different actor so no single person can move stock end-to-end.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import type { TransferStatus } from './schemas'

/** The only legal `status` hops. */
export const TRANSFER_TRANSITIONS: ReadonlyArray<readonly [TransferStatus, TransferStatus]> = [
  ['pending', 'approved'],
  ['pending', 'rejected'],
  ['approved', 'executed'],
  ['executed', 'received'],
]

export function canTransferTransition(from: TransferStatus, to: TransferStatus): boolean {
  return TRANSFER_TRANSITIONS.some(([a, b]) => a === from && b === to)
}

/** Whose action the workflow is waiting on. */
export type TransferActor = 'approver' | 'sender' | 'receiver'

/**
 * The actor who must act next for a transfer in `status`, or `null` when the
 * transfer is finished (`received`) or dead (`rejected`).
 */
export function nextActor(status: TransferStatus): TransferActor | null {
  switch (status) {
    case 'pending':
      return 'approver'
    case 'approved':
      return 'sender'
    case 'executed':
      return 'receiver'
    case 'rejected':
    case 'received':
      return null
  }
}
