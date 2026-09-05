import { describe, expect, it } from 'vitest'

import { reorderAlerts } from '../reorder-alerts'

describe('reorderAlerts', () => {
  it('flags a material below its reorder point', () => {
    const alerts = reorderAlerts(
      [{ $id: 'm1', reorder_point: 100 }],
      new Map([['m1', 40]]),
    )
    expect(alerts).toEqual([{ rawMaterialId: 'm1', onHand: 40, reorderPoint: 100, shortfall: 60 }])
  })

  it('does not flag a material exactly at its reorder point', () => {
    const alerts = reorderAlerts(
      [{ $id: 'm1', reorder_point: 100 }],
      new Map([['m1', 100]]),
    )
    expect(alerts).toEqual([])
  })

  it('does not flag a material above its reorder point', () => {
    const alerts = reorderAlerts(
      [{ $id: 'm1', reorder_point: 100 }],
      new Map([['m1', 150]]),
    )
    expect(alerts).toEqual([])
  })

  it('treats a material with no bin_balances row as zero on hand', () => {
    const alerts = reorderAlerts([{ $id: 'm1', reorder_point: 10 }], new Map())
    expect(alerts).toEqual([{ rawMaterialId: 'm1', onHand: 0, reorderPoint: 10, shortfall: 10 }])
  })

  it('sorts by largest shortfall first', () => {
    const alerts = reorderAlerts(
      [
        { $id: 'small-gap', reorder_point: 50 },
        { $id: 'big-gap', reorder_point: 200 },
      ],
      new Map([
        ['small-gap', 45],
        ['big-gap', 20],
      ]),
    )
    expect(alerts.map((a) => a.rawMaterialId)).toEqual(['big-gap', 'small-gap'])
  })
})
