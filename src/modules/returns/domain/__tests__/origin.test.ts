import { describe, expect, it } from 'vitest'

import { originKind, originWarehouseHint } from '../origin'

describe('originKind', () => {
  it('maps INV- to a sale', () => {
    expect(originKind('INV-2026-00001')).toBe('sale')
  })

  it('maps TRF- to a transfer', () => {
    expect(originKind('TRF-2026-00001')).toBe('transfer')
  })

  it('maps SR- to a receipt', () => {
    expect(originKind('SR-2026-00001')).toBe('receipt')
  })

  it('returns unknown for a prefix that is not a valid origin', () => {
    expect(originKind('WO-2026-00001')).toBe('unknown')
  })

  it('returns unknown for a malformed / unparseable reference', () => {
    expect(originKind('not-a-reference')).toBe('unknown')
    expect(originKind('')).toBe('unknown')
  })
})

describe('originWarehouseHint', () => {
  it('gives a distinct hint per kind', () => {
    const hints = new Set(
      (['sale', 'transfer', 'receipt', 'unknown'] as const).map(originWarehouseHint),
    )
    expect(hints.size).toBe(4)
  })

  it('returns a non-empty string for every kind', () => {
    for (const kind of ['sale', 'transfer', 'receipt', 'unknown'] as const) {
      expect(originWarehouseHint(kind).length).toBeGreaterThan(0)
    }
  })
})
