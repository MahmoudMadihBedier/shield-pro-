import { describe, expect, it } from 'vitest'

import { GEO_REGEX, isValidGeo, parseGeo } from '../geo'

describe('GEO_REGEX', () => {
  it('matches a comma-separated float pair', () => {
    expect(GEO_REGEX.test('30.0444,31.2357')).toBe(true)
    expect(GEO_REGEX.test('-1.5,-2')).toBe(true)
  })

  it('rejects a single value or a spaced pair', () => {
    expect(GEO_REGEX.test('30.0444')).toBe(false)
    expect(GEO_REGEX.test('30.0444, 31.2357')).toBe(false)
  })
})

describe('parseGeo', () => {
  it('parses a valid pair into lat/lng numbers', () => {
    expect(parseGeo('30.0444,31.2357')).toEqual({ lat: 30.0444, lng: 31.2357 })
  })

  it('trims surrounding whitespace', () => {
    expect(parseGeo('  1,2  ')).toEqual({ lat: 1, lng: 2 })
  })

  it('returns null for malformed input', () => {
    expect(parseGeo('not-a-point')).toBeNull()
    expect(parseGeo(null)).toBeNull()
    expect(parseGeo('')).toBeNull()
  })

  it('returns null when out of range', () => {
    expect(parseGeo('91,0')).toBeNull()
    expect(parseGeo('0,181')).toBeNull()
  })
})

describe('isValidGeo', () => {
  it('is true only for a parseable in-range pair', () => {
    expect(isValidGeo('30.0444,31.2357')).toBe(true)
    expect(isValidGeo('200,200')).toBe(false)
  })
})
