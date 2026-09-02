import { describe, expect, it } from 'vitest'

import { explodeBom, type BomLineLike } from '../bom'

const lines: BomLineLike[] = [
  { raw_material_id: 'rm-flour', qty_per_unit: 0.25 },
  { raw_material_id: 'rm-sugar', qty_per_unit: 0.1 },
]

describe('explodeBom', () => {
  it('multiplies every line qty_per_unit by the planned quantity', () => {
    expect(explodeBom(lines, 100)).toEqual([
      { rawMaterialId: 'rm-flour', qty: 25 },
      { rawMaterialId: 'rm-sugar', qty: 10 },
    ])
  })

  it('returns an empty list for an empty BOM', () => {
    expect(explodeBom([], 100)).toEqual([])
  })

  it('sums lines that reference the same raw material, keeping first-seen order', () => {
    const withDupes: BomLineLike[] = [
      { raw_material_id: 'rm-a', qty_per_unit: 1 },
      { raw_material_id: 'rm-b', qty_per_unit: 2 },
      { raw_material_id: 'rm-a', qty_per_unit: 3 },
    ]
    expect(explodeBom(withDupes, 10)).toEqual([
      { rawMaterialId: 'rm-a', qty: 40 },
      { rawMaterialId: 'rm-b', qty: 20 },
    ])
  })

  it('yields zero demand for a planned quantity of zero', () => {
    expect(explodeBom(lines, 0)).toEqual([
      { rawMaterialId: 'rm-flour', qty: 0 },
      { rawMaterialId: 'rm-sugar', qty: 0 },
    ])
  })

  it('throws on a negative planned quantity', () => {
    expect(() => explodeBom(lines, -1)).toThrow(/non-negative/)
  })

  it('throws on a non-finite planned quantity', () => {
    expect(() => explodeBom(lines, Number.NaN)).toThrow()
  })
})
