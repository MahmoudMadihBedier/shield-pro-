import { describe, expect, it } from 'vitest'

import { isValidPin, PIN_LENGTH, portalEmailForCode, PORTAL_EMAIL_DOMAIN } from '../portal'

describe('portalEmailForCode', () => {
  it('lowercases the code', () => {
    expect(portalEmailForCode('CUST001')).toBe(`cust001@${PORTAL_EMAIL_DOMAIN}`)
  })

  it('trims surrounding whitespace', () => {
    expect(portalEmailForCode('  cust001  ')).toBe(`cust001@${PORTAL_EMAIL_DOMAIN}`)
  })

  it('trims and lowercases together', () => {
    expect(portalEmailForCode('  Cust-002  ')).toBe(`cust-002@${PORTAL_EMAIL_DOMAIN}`)
  })

  it('is deterministic — the same code always derives the same email', () => {
    expect(portalEmailForCode('CUST001')).toBe(portalEmailForCode('cust001'))
  })
})

describe('isValidPin', () => {
  it('accepts exactly 8 digits', () => {
    expect(isValidPin('12345678')).toBe(true)
    expect('12345678').toHaveLength(PIN_LENGTH)
  })

  it('rejects a PIN that is too short', () => {
    expect(isValidPin('1234567')).toBe(false)
  })

  it('rejects a PIN that is too long', () => {
    expect(isValidPin('123456789')).toBe(false)
  })

  it('rejects non-digit characters', () => {
    expect(isValidPin('1234abcd')).toBe(false)
  })

  it('rejects a PIN with surrounding whitespace', () => {
    expect(isValidPin(' 12345678 ')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(isValidPin('')).toBe(false)
  })
})
