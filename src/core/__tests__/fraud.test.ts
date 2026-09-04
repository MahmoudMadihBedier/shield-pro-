import { describe, expect, it } from 'vitest'

import {
  dedupeCandidates,
  detectHighReversalRatio,
  detectRepeatedMovement,
  detectRoundTripping,
  type LedgerMove,
} from '../fraud'

function move(over: Partial<LedgerMove>): LedgerMove {
  return {
    voucherType: 'WarehouseTransfer',
    voucherNo: 'WT-2026-00001',
    productId: 'prod-1',
    warehouseId: 'wh-1',
    qtyChange: 10,
    postingDatetime: '2026-09-01T09:00:00.000Z',
    ...over,
  }
}

describe('detectRoundTripping', () => {
  it('flags an equal-and-opposite move on a different voucher within the window', () => {
    const moves = [
      move({ voucherNo: 'WT-1', qtyChange: -50, postingDatetime: '2026-09-01T09:00:00.000Z' }),
      move({ voucherNo: 'WT-2', qtyChange: 50, postingDatetime: '2026-09-01T11:00:00.000Z' }),
    ]
    const out = detectRoundTripping(moves)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      kind: 'round_tripping',
      subjectType: 'product_warehouse',
      subjectId: 'prod-1:wh-1',
    })
  })

  it('does not flag when the returning quantity differs by more than 1%', () => {
    const moves = [
      move({ voucherNo: 'WT-1', qtyChange: -50, postingDatetime: '2026-09-01T09:00:00.000Z' }),
      move({ voucherNo: 'WT-2', qtyChange: 40, postingDatetime: '2026-09-01T11:00:00.000Z' }),
    ]
    expect(detectRoundTripping(moves)).toEqual([])
  })

  it('does not flag when the opposite move falls outside the window', () => {
    const moves = [
      move({ voucherNo: 'WT-1', qtyChange: -50, postingDatetime: '2026-09-01T09:00:00.000Z' }),
      move({ voucherNo: 'WT-2', qtyChange: 50, postingDatetime: '2026-09-03T09:00:00.000Z' }),
    ]
    expect(detectRoundTripping(moves, { windowHours: 24 })).toEqual([])
  })

  it('does not flag two opposite-sign lines that belong to the same voucher', () => {
    const moves = [
      move({ voucherNo: 'WT-1', qtyChange: -50, postingDatetime: '2026-09-01T09:00:00.000Z' }),
      move({ voucherNo: 'WT-1', qtyChange: 50, postingDatetime: '2026-09-01T09:05:00.000Z' }),
    ]
    expect(detectRoundTripping(moves)).toEqual([])
  })

  it('does not flag two moves in the same direction', () => {
    const moves = [
      move({ voucherNo: 'WT-1', qtyChange: 50, postingDatetime: '2026-09-01T09:00:00.000Z' }),
      move({ voucherNo: 'WT-2', qtyChange: 50, postingDatetime: '2026-09-01T10:00:00.000Z' }),
    ]
    expect(detectRoundTripping(moves)).toEqual([])
  })
})

describe('detectRepeatedMovement', () => {
  function vouchersAt(times: string[]): LedgerMove[] {
    return times.map((t, i) => move({ voucherNo: `WT-${i}`, postingDatetime: t }))
  }

  it('flags a product+warehouse pair touched by more than maxCount distinct vouchers in the window', () => {
    const times = [
      '2026-09-01T00:00:00.000Z',
      '2026-09-01T01:00:00.000Z',
      '2026-09-01T02:00:00.000Z',
      '2026-09-01T03:00:00.000Z',
      '2026-09-01T04:00:00.000Z',
      '2026-09-01T05:00:00.000Z',
    ]
    const out = detectRepeatedMovement(vouchersAt(times), { maxCount: 5, windowHours: 24 })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'repeated_movement', subjectId: 'prod-1:wh-1' })
  })

  it('does not flag when the distinct-voucher count stays at or under maxCount', () => {
    const times = [
      '2026-09-01T00:00:00.000Z',
      '2026-09-01T01:00:00.000Z',
      '2026-09-01T02:00:00.000Z',
      '2026-09-01T03:00:00.000Z',
      '2026-09-01T04:00:00.000Z',
    ]
    expect(detectRepeatedMovement(vouchersAt(times), { maxCount: 5, windowHours: 24 })).toEqual([])
  })

  it('does not count vouchers separated by more than the window as part of the same burst', () => {
    // 6 vouchers total, but split across two days more than windowHours apart —
    // no single windowHours-wide slice contains more than 5.
    const times = [
      '2026-09-01T00:00:00.000Z',
      '2026-09-01T01:00:00.000Z',
      '2026-09-01T02:00:00.000Z',
      '2026-09-01T03:00:00.000Z',
      '2026-09-01T04:00:00.000Z',
      '2026-09-03T04:00:00.000Z',
    ]
    expect(detectRepeatedMovement(vouchersAt(times), { maxCount: 5, windowHours: 24 })).toEqual([])
  })

  it('treats a voucher exactly windowHours after the first as still inside the window', () => {
    // First and last are exactly 24h apart — the boundary is inclusive, so this
    // still counts as 5 distinct vouchers in one window (maxCount 4 is exceeded).
    const times = [
      '2026-09-01T00:00:00.000Z',
      '2026-09-01T06:00:00.000Z',
      '2026-09-01T12:00:00.000Z',
      '2026-09-01T18:00:00.000Z',
      '2026-09-02T00:00:00.000Z', // exactly 24h after the first
    ]
    const out = detectRepeatedMovement(vouchersAt(times), { maxCount: 4, windowHours: 24 })
    expect(out).toHaveLength(1)
  })

  it('excludes a voucher one second past the window boundary from the burst', () => {
    const times = [
      '2026-09-01T00:00:00.000Z',
      '2026-09-01T06:00:00.000Z',
      '2026-09-01T12:00:00.000Z',
      '2026-09-01T18:00:00.000Z',
      '2026-09-02T00:00:01.000Z', // 24h + 1s after the first
    ]
    const out = detectRepeatedMovement(vouchersAt(times), { maxCount: 4, windowHours: 24 })
    expect(out).toEqual([])
  })
})

describe('detectHighReversalRatio', () => {
  it('flags an actor whose cancellation ratio exceeds the threshold', () => {
    const out = detectHighReversalRatio('user-1', 10, 3, { thresholdPct: 0.2, minSubmitted: 5 })
    expect(out).toMatchObject({
      kind: 'high_reversal_ratio',
      subjectType: 'actor',
      subjectId: 'user-1',
    })
  })

  it('does not flag an actor at or under the threshold', () => {
    expect(
      detectHighReversalRatio('user-1', 10, 2, { thresholdPct: 0.2, minSubmitted: 5 }),
    ).toBeNull()
  })

  it('does not flag an actor below the minSubmitted floor even with a bad ratio', () => {
    expect(
      detectHighReversalRatio('user-1', 3, 2, { thresholdPct: 0.2, minSubmitted: 5 }),
    ).toBeNull()
  })
})

describe('dedupeCandidates', () => {
  it('drops a candidate whose (kind, subjectId) already has an open flag', () => {
    const candidates = [
      {
        kind: 'round_tripping' as const,
        subjectType: 'product_warehouse',
        subjectId: 'p1:wh1',
        detail: 'x',
      },
      {
        kind: 'repeated_movement' as const,
        subjectType: 'product_warehouse',
        subjectId: 'p2:wh2',
        detail: 'y',
      },
    ]
    const out = dedupeCandidates([{ kind: 'round_tripping', subjectId: 'p1:wh1' }], candidates)
    expect(out).toEqual([candidates[1]])
  })

  it('keeps a candidate with no matching open flag', () => {
    const candidates = [
      {
        kind: 'high_reversal_ratio' as const,
        subjectType: 'actor',
        subjectId: 'user-9',
        detail: 'z',
      },
    ]
    expect(
      dedupeCandidates([{ kind: 'round_tripping', subjectId: 'someone-else' }], candidates),
    ).toEqual(candidates)
  })
})
