import { describe, expect, it } from 'vitest'

import {
  parseLines,
  parsePoLines,
  parseReceiptLines,
  poTotal,
  receivedVsOrdered,
  serializeLines,
} from '../lines'
import { poLineSchema } from '../schemas'

const lines = [
  { raw_material_id: 'rm-1', qty: 3, unit_price: 10 },
  { raw_material_id: 'rm-2', qty: 2, unit_price: 4.5 },
]

describe('parseLines / serializeLines', () => {
  it('round-trips a typed array', () => {
    expect(parsePoLines(serializeLines(lines))).toEqual(lines)
  })

  it('treats "", "[]", null and undefined as an empty array', () => {
    expect(parsePoLines('')).toEqual([])
    expect(parsePoLines('  ')).toEqual([])
    expect(parsePoLines('[]')).toEqual([])
    expect(parsePoLines(null)).toEqual([])
    expect(parsePoLines(undefined)).toEqual([])
  })

  it('serializes null / undefined to "[]"', () => {
    expect(serializeLines(null)).toBe('[]')
    expect(serializeLines(undefined)).toBe('[]')
  })

  it('returns [] for malformed JSON rather than throwing', () => {
    expect(parseLines('{not json', poLineSchema)).toEqual([])
  })

  it('drops a payload that fails the item schema', () => {
    expect(
      parseLines('[{"raw_material_id":"rm-1","qty":-1,"unit_price":1}]', poLineSchema),
    ).toEqual([])
  })

  it('parseReceiptLines parses receipt-shaped lines', () => {
    expect(parseReceiptLines(serializeLines(lines))).toEqual(lines)
  })
})

describe('poTotal', () => {
  it('sums qty · unit_price across lines', () => {
    expect(poTotal(lines)).toBe(3 * 10 + 2 * 4.5)
  })

  it('is 0 for no lines', () => {
    expect(poTotal([])).toBe(0)
  })
})

describe('receivedVsOrdered', () => {
  it('reports ordered / received / remaining per material', () => {
    const result = receivedVsOrdered(
      [
        { raw_material_id: 'rm-1', qty: 10 },
        { raw_material_id: 'rm-2', qty: 5 },
      ],
      [
        { raw_material_id: 'rm-1', qty: 4 },
        { raw_material_id: 'rm-1', qty: 2 },
      ],
    )
    expect(result.overReceived).toBe(false)
    expect(result.byMaterial).toEqual([
      { raw_material_id: 'rm-1', ordered: 10, received: 6, remaining: 4, overReceived: false },
      { raw_material_id: 'rm-2', ordered: 5, received: 0, remaining: 5, overReceived: false },
    ])
  })

  it('flags an over-receipt and reports a negative remaining', () => {
    const result = receivedVsOrdered(
      [{ raw_material_id: 'rm-1', qty: 10 }],
      [{ raw_material_id: 'rm-1', qty: 12 }],
    )
    expect(result.overReceived).toBe(true)
    expect(result.byMaterial[0]).toEqual({
      raw_material_id: 'rm-1',
      ordered: 10,
      received: 12,
      remaining: -2,
      overReceived: true,
    })
  })

  it('appends a received-only material after the ordered ones', () => {
    const result = receivedVsOrdered(
      [{ raw_material_id: 'rm-1', qty: 1 }],
      [{ raw_material_id: 'rm-9', qty: 3 }],
    )
    expect(result.byMaterial.map((m) => m.raw_material_id)).toEqual(['rm-1', 'rm-9'])
    expect(result.byMaterial[1]).toMatchObject({ ordered: 0, received: 3, overReceived: true })
  })
})
