import { describe, expect, it } from 'vitest'

import { googleMapsUrl, isValidGeo, parseGeo } from '../geo'

describe('parseGeo', () => {
  it('parses a well-formed pair', () => {
    expect(parseGeo(' 30.0444,31.2357 ')).toEqual({ lat: 30.0444, lng: 31.2357 })
    expect(parseGeo('-1,-1')).toEqual({ lat: -1, lng: -1 })
  })

  it('rejects malformed or out-of-range input', () => {
    for (const bad of ['', 'abc', '30', '30,', '91,0', '0,181', '30 31', null, undefined]) {
      expect(parseGeo(bad)).toBeNull()
    }
  })
})

describe('isValidGeo', () => {
  it('mirrors parseGeo', () => {
    expect(isValidGeo('30,31')).toBe(true)
    expect(isValidGeo('200,0')).toBe(false)
  })
})

describe('googleMapsUrl', () => {
  it('builds a maps link for a valid pair', () => {
    expect(googleMapsUrl('30.0444,31.2357')).toBe(
      'https://www.google.com/maps/search/?api=1&query=30.0444,31.2357',
    )
  })
  it('returns null for an invalid pair', () => {
    expect(googleMapsUrl('nope')).toBeNull()
  })
})
