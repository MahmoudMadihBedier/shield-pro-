/**
 * Segregation of duties (SoD) — the "no one signs off their own work" rule set
 * (Implementation Plan §4.4). One declarative table of actor-column pairs and a
 * pure checker; every `submit-document` / `cancel-document` path runs it before
 * confirming a document.
 *
 * The conceptual pairs from the plan are:
 *   requestedBy       !== approvedBy
 *   sentBy            !== confirmedReceivedBy
 *   soldBy            !== cashUpConfirmedBy
 *   purchaseEnteredBy !== paymentApprovedBy
 *
 * Mapped onto the columns that actually exist on the submittable-document tables
 * (`scripts/appwrite/schema.ts`). The purchase/payment pair has no dedicated
 * actor columns in the frozen schema, so it is expressed generically as
 * `created_by !== approved_by` (whoever entered the document may not be the one
 * who approves it) — see FINAL REPORT / possible schema follow-up.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

/** One SoD constraint: on any row carrying BOTH columns, `a` must differ from `b`. */
export interface SodRule {
  id: string
  /** First actor column (e.g. the person who requested / entered / sent). */
  a: string
  /** Second actor column (e.g. the person who approved / received / confirmed). */
  b: string
  /** Human-readable explanation, used in the thrown error message. */
  message: string
}

export const SOD_RULES: readonly SodRule[] = [
  {
    id: 'requested-vs-approved',
    a: 'requested_by',
    b: 'approved_by',
    message: 'the person who requested a document may not approve it',
  },
  {
    id: 'sent-vs-received',
    a: 'sent_by',
    b: 'confirmed_received_by',
    message: 'the person who sent a transfer may not confirm its receipt',
  },
  {
    id: 'sold-vs-cashup',
    a: 'sold_by',
    b: 'cashup_confirmed_by',
    message: 'the person who sold an invoice may not confirm its cash-up',
  },
  {
    id: 'entered-vs-approved',
    a: 'created_by',
    b: 'approved_by',
    message: 'the person who entered a document may not approve its payment',
  },
] as const

/** A column counts as "present" only when it holds a non-empty string. */
function filled(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * For every rule whose BOTH columns are filled on `row`, require `a !== b`.
 * Returns the ids of the rules that were violated (empty === clean).
 */
export function checkSegregation(row: Record<string, unknown>): { violated: string[] } {
  const violated: string[] = []
  for (const rule of SOD_RULES) {
    const left = row[rule.a]
    const right = row[rule.b]
    if (filled(left) && filled(right) && left === right) {
      violated.push(rule.id)
    }
  }
  return { violated }
}

/** Error thrown by `assertNoSelfApproval`; `code` lets the Function layer map it. */
interface SodError extends Error {
  code: 'sod'
  violated: string[]
}

/**
 * Throw when `row` violates any SoD rule. The Function layer catches this and
 * re-raises it as `FnError('forbidden', …)`.
 */
export function assertNoSelfApproval(row: Record<string, unknown>): void {
  const { violated } = checkSegregation(row)
  if (violated.length === 0) return

  const byId = new Map(SOD_RULES.map((r) => [r.id, r]))
  const reasons = violated.map((id) => byId.get(id)?.message ?? id).join('; ')
  const err = new Error(`segregation of duties violated: ${reasons}`) as SodError
  err.code = 'sod'
  err.violated = violated
  throw err
}
