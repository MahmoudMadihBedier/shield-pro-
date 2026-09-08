import { describe, expect, it } from 'vitest'

import {
  DEFAULT_UNIT,
  formatQtyWithUnit,
  parseSaleUnits,
  resolveSaleUnits,
  serializeSaleUnits,
  toBaseQty,
  UNIT_OPTIONS,
  UNITS,
  unitLabel,
  unitSchema,
  unitShort,
} from '../uom'

describe('unit list', () => {
  it('has a bilingual label for every unit and no duplicates', () => {
    expect(new Set(UNITS).size).toBe(UNITS.length)
    for (const u of UNITS) expect(unitLabel(u)).toMatch(/ \/ /)
    expect(UNITS).toContain(DEFAULT_UNIT)
  })

  it('keeps the seed-data codes valid (`pc`, `kg`)', () => {
    expect(unitSchema.safeParse('pc').success).toBe(true)
    expect(unitSchema.safeParse('kg').success).toBe(true)
    expect(unitSchema.safeParse('barrel').success).toBe(false)
  })

  it('UNIT_OPTIONS mirrors UNITS in order', () => {
    expect(UNIT_OPTIONS.map((o) => o.value)).toEqual([...UNITS])
  })
})

describe('unitShort / unitLabel fallbacks', () => {
  it('returns the Arabic short label for a known code', () => {
    expect(unitShort('carton')).toBe('كرتونة')
    expect(unitShort('kg')).toBe('كيلوجرام')
  })

  it('passes an unknown code straight through and blanks null/undefined', () => {
    expect(unitShort('widget')).toBe('widget')
    expect(unitShort(null)).toBe('')
    expect(unitLabel(undefined)).toBe('')
  })
})

describe('formatQtyWithUnit', () => {
  it('appends the short unit', () => {
    expect(formatQtyWithUnit(12, 'carton')).toBe('12 كرتونة')
    expect(formatQtyWithUnit(3.5, 'kg')).toBe('3.5 كيلوجرام')
  })
  it('drops the suffix when there is no unit', () => {
    expect(formatQtyWithUnit(5, null)).toBe('5')
  })
})

describe('sale units', () => {
  it('round-trips and rejects a non-positive factor', () => {
    const list = [{ unit: 'carton' as const, factor: 12, label: 'كرتونة' }]
    expect(parseSaleUnits(serializeSaleUnits(list))).toEqual(list)
    expect(parseSaleUnits('[{"unit":"carton","factor":0}]')).toEqual([])
    expect(parseSaleUnits('[{"unit":"barrel","factor":5}]')).toEqual([])
    expect(parseSaleUnits(null)).toEqual([])
  })

  it('resolveSaleUnits puts the stock unit first (factor 1) then de-dupes alternates', () => {
    const resolved = resolveSaleUnits(
      'pc',
      '[{"unit":"carton","factor":12,"label":"كرتونة"},{"unit":"pc","factor":1},{"unit":"dozen","factor":12}]',
    )
    expect(resolved.map((r) => [r.unit, r.factor])).toEqual([
      ['pc', 1],
      ['carton', 12],
      ['dozen', 12],
    ])
    expect(resolved[0]!.label).toBe('قطعة')
    expect(resolved[1]!.label).toBe('كرتونة')
  })

  it('falls back to the default unit when the stock unit is unknown', () => {
    const resolved = resolveSaleUnits('barrel', null)
    expect(resolved).toEqual([{ unit: DEFAULT_UNIT, factor: 1, label: unitShort(DEFAULT_UNIT) }])
  })

  it('toBaseQty multiplies sale qty by the factor', () => {
    expect(toBaseQty(2, 12)).toBe(24)
    expect(toBaseQty(3.5, 1)).toBe(3.5)
  })
})
