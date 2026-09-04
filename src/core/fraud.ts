/**
 * Fraud-detection heuristics (Implementation Plan §4 / Phase 2 Story 2.3).
 *
 * Each `detect*` function is a pure predicate over plain arrays of
 * already-fetched rows — the `/fraud-scan` Function does the fetching (reads
 * from `stock_ledger_entries` / `audit_log`) and this module only decides
 * which patterns look suspicious. No I/O, no Appwrite, no framework imports.
 *
 * Three heuristics, mirroring `fraud_flags.kind` in `scripts/appwrite/schema.ts`:
 *  - `round_tripping`      — stock leaves and an equal-ish quantity comes back
 *    for the same product+warehouse within a short window, via two different
 *    vouchers (a proxy for a movement with no real business justification).
 *  - `repeated_movement`   — an unusually large number of distinct vouchers
 *    touch the same product+warehouse pair within a short window (splitting a
 *    large movement into many small ones to dodge an approval threshold).
 *  - `high_reversal_ratio` — one actor cancels an unusually high share of what
 *    they submit.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

export interface LedgerMove {
  voucherType: string
  voucherNo: string
  productId: string
  warehouseId: string
  qtyChange: number
  postingDatetime: string
}

export interface AuditEvent {
  actorId: string
  action: string
  entityType: string
  entityRef: string
  createdAt: string
}

export type FraudKind = 'round_tripping' | 'repeated_movement' | 'high_reversal_ratio'

export interface FraudCandidate {
  kind: FraudKind
  subjectType: string
  subjectId: string
  detail: string
}

const HOUR_MS = 3_600_000
const DEFAULT_WINDOW_HOURS = 24
const DEFAULT_MAX_COUNT = 5
const DEFAULT_MIN_SUBMITTED = 5
const DEFAULT_THRESHOLD_PCT = 0.2
/** Two opposite-sign moves count as "near-equal" within this relative tolerance. */
const ROUND_TRIP_TOLERANCE_PCT = 0.01

function parseTime(iso: string): number {
  return new Date(iso).getTime()
}

function productWarehouseKey(move: Pick<LedgerMove, 'productId' | 'warehouseId'>): string {
  return `${move.productId}:${move.warehouseId}`
}

function groupByProductWarehouse(moves: LedgerMove[]): Map<string, LedgerMove[]> {
  const groups = new Map<string, LedgerMove[]>()
  for (const move of moves) {
    const key = productWarehouseKey(move)
    const existing = groups.get(key)
    if (existing) existing.push(move)
    else groups.set(key, [move])
  }
  return groups
}

/**
 * Flag a product+warehouse pair when stock moves out and an equal-or-near-equal
 * quantity moves back in within `windowHours` (default 24h), via two different
 * vouchers. One candidate per offending pair — the scan runs periodically, so a
 * single flag per group is enough to surface the pattern for review.
 */
export function detectRoundTripping(
  moves: LedgerMove[],
  opts: { windowHours?: number } = {},
): FraudCandidate[] {
  const windowMs = (opts.windowHours ?? DEFAULT_WINDOW_HOURS) * HOUR_MS
  const candidates: FraudCandidate[] = []

  for (const [key, groupMoves] of groupByProductWarehouse(moves)) {
    const sorted = [...groupMoves].sort(
      (a, b) => parseTime(a.postingDatetime) - parseTime(b.postingDatetime),
    )

    let found = false
    for (let i = 0; i < sorted.length && !found; i++) {
      const a = sorted[i]
      if (!a) continue
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]
        if (!b) continue
        const deltaMs = parseTime(b.postingDatetime) - parseTime(a.postingDatetime)
        if (deltaMs > windowMs) break // sorted ascending — no later move can be in-window either

        if (a.voucherNo === b.voucherNo) continue
        const signA = Math.sign(a.qtyChange)
        const signB = Math.sign(b.qtyChange)
        if (signA === 0 || signB === 0 || signA === signB) continue

        const magA = Math.abs(a.qtyChange)
        const magB = Math.abs(b.qtyChange)
        const maxMag = Math.max(magA, magB)
        if (maxMag === 0) continue
        const diffPct = Math.abs(magA - magB) / maxMag
        if (diffPct > ROUND_TRIP_TOLERANCE_PCT) continue

        candidates.push({
          kind: 'round_tripping',
          subjectType: 'product_warehouse',
          subjectId: key,
          detail:
            `stock round-tripped for "${key}": voucher ${a.voucherNo} moved ${a.qtyChange} at ` +
            `${a.postingDatetime}, voucher ${b.voucherNo} moved ${b.qtyChange} at ${b.postingDatetime}`,
        })
        found = true
        break
      }
    }
  }

  return candidates
}

/**
 * Flag a product+warehouse pair when more than `maxCount` (default 5) distinct
 * vouchers touch it within any `windowHours`-wide slice (default 24h) —
 * splitting a large movement into many small ones to dodge a threshold.
 */
export function detectRepeatedMovement(
  moves: LedgerMove[],
  opts: { maxCount?: number; windowHours?: number } = {},
): FraudCandidate[] {
  const maxCount = opts.maxCount ?? DEFAULT_MAX_COUNT
  const windowMs = (opts.windowHours ?? DEFAULT_WINDOW_HOURS) * HOUR_MS
  const candidates: FraudCandidate[] = []

  for (const [key, groupMoves] of groupByProductWarehouse(moves)) {
    // One timestamp per distinct voucher (its earliest posting in the group).
    const voucherTimes = new Map<string, number>()
    for (const move of groupMoves) {
      const t = parseTime(move.postingDatetime)
      const existing = voucherTimes.get(move.voucherNo)
      if (existing === undefined || t < existing) voucherTimes.set(move.voucherNo, t)
    }

    const times = [...voucherTimes.values()].sort((a, b) => a - b)
    let left = 0
    let maxInWindow = 0
    for (let right = 0; right < times.length; right++) {
      const rightTime = times[right]
      if (rightTime === undefined) continue
      let leftTime = times[left]
      while (leftTime !== undefined && rightTime - leftTime > windowMs) {
        left++
        leftTime = times[left]
      }
      maxInWindow = Math.max(maxInWindow, right - left + 1)
    }

    if (maxInWindow > maxCount) {
      candidates.push({
        kind: 'repeated_movement',
        subjectType: 'product_warehouse',
        subjectId: key,
        detail: `${maxInWindow} distinct vouchers moved "${key}" within a ${opts.windowHours ?? DEFAULT_WINDOW_HOURS}h window (limit ${maxCount})`,
      })
    }
  }

  return candidates
}

/**
 * Flag one actor when their cancellation ratio is unusually high:
 * `cancelledCount / submittedCount > thresholdPct` (default 20%) — but only
 * once they have submitted at least `minSubmitted` (default 5) documents, so a
 * single early cancellation does not trip the heuristic.
 */
export function detectHighReversalRatio(
  actorId: string,
  submittedCount: number,
  cancelledCount: number,
  opts: { minSubmitted?: number; thresholdPct?: number } = {},
): FraudCandidate | null {
  const minSubmitted = opts.minSubmitted ?? DEFAULT_MIN_SUBMITTED
  const thresholdPct = opts.thresholdPct ?? DEFAULT_THRESHOLD_PCT

  if (submittedCount < minSubmitted || submittedCount <= 0) return null
  const ratio = cancelledCount / submittedCount
  if (ratio <= thresholdPct) return null

  return {
    kind: 'high_reversal_ratio',
    subjectType: 'actor',
    subjectId: actorId,
    detail: `${cancelledCount} of ${submittedCount} submissions were cancelled (${(ratio * 100).toFixed(1)}%), above the ${(thresholdPct * 100).toFixed(0)}% threshold`,
  }
}

/**
 * Drop a candidate when an `open` flag already exists for the same
 * `(kind, subjectId)` — a periodic scan should not re-flag a subject that is
 * already sitting in the review queue.
 */
export function dedupeCandidates(
  existingOpenSubjects: Array<{ kind: string; subjectId: string }>,
  candidates: FraudCandidate[],
): FraudCandidate[] {
  const open = new Set(existingOpenSubjects.map((s) => `${s.kind}:${s.subjectId}`))
  return candidates.filter((c) => !open.has(`${c.kind}:${c.subjectId}`))
}
