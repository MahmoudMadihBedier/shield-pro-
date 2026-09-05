/**
 * SLA-breach detection for pending `approval_requests` — flags requests that
 * have sat in `state: 'pending'` longer than the allowed SLA window.
 *
 * Pure TypeScript, zero I/O (`claude.md` B.4).
 */

export interface SlaBreach {
  approvalRequestId: string
  entityRef: string
  ageHours: number
}

export interface PendingApprovalLike {
  $id: string
  entity_ref: string
  created_at: string
}

const DEFAULT_SLA_HOURS = 24
const MS_PER_HOUR = 60 * 60 * 1000

/**
 * `pendingRequests` older than `slaHours` (strictly greater than — a request
 * exactly at the boundary has not yet breached), sorted oldest (largest age)
 * first so the worst breach leads.
 */
export function slaBreaches(
  pendingRequests: readonly PendingApprovalLike[],
  slaHours: number = DEFAULT_SLA_HOURS,
  now: Date = new Date(),
): SlaBreach[] {
  const nowMs = now.getTime()
  const breaches: SlaBreach[] = []
  for (const req of pendingRequests) {
    const ageHours = (nowMs - new Date(req.created_at).getTime()) / MS_PER_HOUR
    if (ageHours > slaHours) {
      breaches.push({ approvalRequestId: req.$id, entityRef: req.entity_ref, ageHours })
    }
  }
  return breaches.sort((a, b) => b.ageHours - a.ageHours)
}
