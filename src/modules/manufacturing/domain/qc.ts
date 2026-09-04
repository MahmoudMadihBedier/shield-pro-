/**
 * The QC (quality-control) hold/release state machine for a production batch
 * (`production_batches.qc_status`), per `IMPLEMENTATION_PLAN.md` Phase 2 Story
 * 2.7. Building the machine + UI now; the enforcing Appwrite Function lands
 * later.
 *
 *   pending_qc --release--> released
 *   pending_qc --reject---> rejected
 *
 * A batch is only transferable out of factory custody once `released`. There is
 * no transition *out* of `released` / `rejected` — a mistake is corrected by
 * cancelling the batch document and amending (ERPNext `docstatus` model).
 *
 * `domain` is pure TypeScript — no react, no appwrite imports.
 */
import type { QcStatus } from './schemas'

/** The only allowed `qc_status` transitions. */
export const QC_TRANSITIONS: ReadonlyArray<readonly [QcStatus, QcStatus]> = [
  ['pending_qc', 'released'],
  ['pending_qc', 'rejected'],
]

export function canQcTransition(from: QcStatus, to: QcStatus): boolean {
  return QC_TRANSITIONS.some(([a, b]) => a === from && b === to)
}

/** Only a `released` batch may leave factory custody. */
export function isTransferable(qcStatus: QcStatus): boolean {
  return qcStatus === 'released'
}
