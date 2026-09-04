import { describe, expect, it } from 'vitest'

import {
  parseRawMaterialLots,
  parseRequiredMaterials,
  requiredMaterialsFor,
  serializeRawMaterialLots,
  serializeRequiredMaterials,
} from '../planning'
import type { RawMaterialLot, RequiredMaterialLine } from '../schemas'

const bom = [
  { raw_material_id: 'rm-flour', qty_per_unit: 0.25 },
  { raw_material_id: 'rm-sugar', qty_per_unit: 0.1 },
]

describe('requiredMaterialsFor', () => {
  it('shapes exploded BOM demand to the required_materials column', () => {
    expect(requiredMaterialsFor(bom, 100)).toEqual([
      { raw_material_id: 'rm-flour', qty: 25 },
      { raw_material_id: 'rm-sugar', qty: 10 },
    ])
  })

  it('returns an empty list for an empty BOM', () => {
    expect(requiredMaterialsFor([], 100)).toEqual([])
  })
})

describe('required_materials round-trip', () => {
  it('parse(serialize(x)) === x', () => {
    const lines: RequiredMaterialLine[] = [{ raw_material_id: 'rm-a', qty: 3 }]
    const result = parseRequiredMaterials(serializeRequiredMaterials(lines))
    expect(result).toEqual({ ok: true, value: lines })
  })

  it('treats an empty string as an empty list', () => {
    expect(parseRequiredMaterials('')).toEqual({ ok: true, value: [] })
  })

  it('fails with a validation error on non-JSON', () => {
    const result = parseRequiredMaterials('not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('validation')
  })

  it('fails when a line does not match the schema', () => {
    expect(parseRequiredMaterials('[{"raw_material_id":"rm-a"}]').ok).toBe(false)
  })
})

describe('raw_material_lots round-trip', () => {
  it('parse(serialize(x)) === x', () => {
    const lots: RawMaterialLot[] = [{ purchase_order_ref: 'PO-2026-1', qty_consumed: 12.5 }]
    const result = parseRawMaterialLots(serializeRawMaterialLots(lots))
    expect(result).toEqual({ ok: true, value: lots })
  })

  it('rejects a lot with a non-positive qty_consumed', () => {
    expect(parseRawMaterialLots('[{"purchase_order_ref":"PO-1","qty_consumed":0}]').ok).toBe(false)
  })
})
