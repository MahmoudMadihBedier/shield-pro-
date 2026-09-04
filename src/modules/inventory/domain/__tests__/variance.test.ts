import { describe, expect, it } from 'vitest'

import {
  computeVariances,
  hasVariance,
  parseCounts,
  parseVariances,
  serializeCounts,
  serializeVariances,
} from '../variance'
import type { CountLine, VarianceLine } from '../schemas'

describe('computeVariances', () => {
  const counts: CountLine[] = [
    { product_id: 'over', counted_qty: 12 },
    { product_id: 'short', counted_qty: 4 },
    { product_id: 'exact', counted_qty: 8 },
    { product_id: 'unrecorded', counted_qty: 3 },
  ]
  const recorded = new Map<string, number>([
    ['over', 10],
    ['short', 9],
    ['exact', 8],
  ])

  it('computes counted − recorded per line', () => {
    const result = computeVariances(counts, recorded)
    expect(result).toEqual([
      { product_id: 'over', recorded_qty: 10, counted_qty: 12, variance: 2 },
      { product_id: 'short', recorded_qty: 9, counted_qty: 4, variance: -5 },
      { product_id: 'exact', recorded_qty: 8, counted_qty: 8, variance: 0 },
      { product_id: 'unrecorded', recorded_qty: 0, counted_qty: 3, variance: 3 },
    ])
  })

  it('treats a product with no bin row as recorded 0', () => {
    const [line] = computeVariances([{ product_id: 'x', counted_qty: 5 }], new Map())
    expect(line).toEqual({ product_id: 'x', recorded_qty: 0, counted_qty: 5, variance: 5 })
  })
})

describe('hasVariance', () => {
  it('is false when every line matches', () => {
    const lines: VarianceLine[] = [
      { product_id: 'a', recorded_qty: 1, counted_qty: 1, variance: 0 },
      { product_id: 'b', recorded_qty: 2, counted_qty: 2, variance: 0 },
    ]
    expect(hasVariance(lines)).toBe(false)
  })

  it('is true when any line differs', () => {
    const lines: VarianceLine[] = [
      { product_id: 'a', recorded_qty: 1, counted_qty: 1, variance: 0 },
      { product_id: 'b', recorded_qty: 2, counted_qty: 5, variance: 3 },
    ]
    expect(hasVariance(lines)).toBe(true)
  })
})

describe('JSON round-trips', () => {
  it('counts survive serialize → parse', () => {
    const lines: CountLine[] = [
      { product_id: 'p1', counted_qty: 3 },
      { product_id: 'p2', counted_qty: 0 },
    ]
    expect(parseCounts(serializeCounts(lines))).toEqual(lines)
  })

  it('variances survive serialize → parse', () => {
    const lines: VarianceLine[] = [
      { product_id: 'p1', recorded_qty: 5, counted_qty: 4, variance: -1 },
    ]
    expect(parseVariances(serializeVariances(lines))).toEqual(lines)
  })

  it('an empty / null column parses to []', () => {
    expect(parseCounts(null)).toEqual([])
    expect(parseCounts('')).toEqual([])
    expect(parseVariances(undefined)).toEqual([])
  })

  it('malformed JSON throws', () => {
    expect(() => parseCounts('{not json')).toThrow()
  })

  it('a schema-violating row throws', () => {
    expect(() => parseCounts('[{"product_id":"p1","counted_qty":-2}]')).toThrow()
  })
})
