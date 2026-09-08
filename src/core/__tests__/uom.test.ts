import { describe, expect, it } from 'vitest'

import {
  DEFAULT_UNIT,
  formatQtyWithUnit,
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
