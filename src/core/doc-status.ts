/**
 * Document lifecycle, mirrored from ERPNext's `docstatus`.
 *
 * Shield Pro's business docs (`نظام_ادارة_الانتاج...` §9, Master Plan §4) require:
 *   - no edits to a confirmed movement / financial record
 *   - no deletes — corrections happen via a NEW linked reversing document
 *
 * ERPNext solves this with three states and exactly two transitions:
 *
 *   Draft (0) --submit--> Submitted (1) --cancel--> Cancelled (2)
 *
 * A "correction" to a Submitted doc is an AMENDMENT: cancel it, then create a
 * new Draft that carries `amendedFrom = <original reference id>`, and submit
 * that. History is never mutated.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

export const DocStatus = {
  Draft: 0,
  Submitted: 1,
  Cancelled: 2,
} as const

export type DocStatus = (typeof DocStatus)[keyof typeof DocStatus]

const ALLOWED_TRANSITIONS: ReadonlyArray<readonly [DocStatus, DocStatus]> = [
  [DocStatus.Draft, DocStatus.Submitted],
  [DocStatus.Submitted, DocStatus.Cancelled],
]

export function canTransition(from: DocStatus, to: DocStatus): boolean {
  return ALLOWED_TRANSITIONS.some(([a, b]) => a === from && b === to)
}

/** A Submitted doc is immutable; only a cancel (→ amendment) may follow. */
export function isImmutable(status: DocStatus): boolean {
  return status === DocStatus.Submitted || status === DocStatus.Cancelled
}

export function docStatusLabel(status: DocStatus): string {
  switch (status) {
    case DocStatus.Draft:
      return 'Draft'
    case DocStatus.Submitted:
      return 'Submitted'
    case DocStatus.Cancelled:
      return 'Cancelled'
  }
}
