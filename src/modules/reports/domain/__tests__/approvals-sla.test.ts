import { describe, expect, it } from 'vitest'

import { slaBreaches } from '../approvals-sla'

const NOW = new Date('2026-08-31T12:00:00.000Z')

describe('slaBreaches', () => {
  it('flags requests strictly older than the SLA window, oldest first', () => {
    const requests = [
      { $id: 'a1', entity_ref: 'PO-1', created_at: '2026-08-30T12:00:00.000Z' }, // 24h
      { $id: 'a2', entity_ref: 'PO-2', created_at: '2026-08-29T12:00:00.000Z' }, // 48h
    ]
    const breaches = slaBreaches(requests, 24, NOW)
    // a1 is exactly at the boundary (24h) — not a breach; a2 (48h) is.
    expect(breaches.map((b) => b.approvalRequestId)).toEqual(['a2'])
    expect(breaches[0]?.ageHours).toBeCloseTo(48)
  })

  it('is not a breach exactly at the SLA boundary', () => {
    const requests = [{ $id: 'a1', entity_ref: 'PO-1', created_at: '2026-08-30T12:00:00.000Z' }]
    expect(slaBreaches(requests, 24, NOW)).toEqual([])
  })

  it('is a breach one second past the boundary', () => {
    const requests = [{ $id: 'a1', entity_ref: 'PO-1', created_at: '2026-08-30T11:59:59.000Z' }]
    expect(slaBreaches(requests, 24, NOW)).toHaveLength(1)
  })

  it('defaults slaHours to 24', () => {
    const requests = [{ $id: 'a1', entity_ref: 'PO-1', created_at: '2026-08-29T00:00:00.000Z' }]
    expect(slaBreaches(requests, undefined, NOW)).toHaveLength(1)
  })

  it('returns an empty array for empty input', () => {
    expect(slaBreaches([], 24, NOW)).toEqual([])
  })
})
