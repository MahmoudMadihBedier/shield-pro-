import { describe, expect, it } from 'vitest'

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatRelativeLatency,
} from '../formatters'

// Assertions pin an explicit locale so output is deterministic across machines.
// Where a glyph set is fragile (Arabic-Indic digits depend on the host ICU),
// we assert on shape, not exact characters.

describe('formatCurrency', () => {
  it('renders an amount with the currency symbol for the given locale', () => {
    expect(formatCurrency(1234.5, { locale: 'en-US', currency: 'USD' })).toBe('$1,234.50')
  })

  it('defaults to the Arabic-first locale + EGP and still produces a non-empty string', () => {
    const out = formatCurrency(50)
    expect(typeof out).toBe('string')
    expect(out.length).toBeGreaterThan(0)
  })
})

describe('formatNumber', () => {
  it('groups thousands and caps fraction digits at 3 by default', () => {
    expect(formatNumber(1234567.8912, { locale: 'en-US' })).toBe('1,234,567.891')
  })

  it('honours an explicit minimumFractionDigits', () => {
    expect(formatNumber(5, { locale: 'en-US', minimumFractionDigits: 2 })).toBe('5.00')
  })
})

describe('formatQuantity', () => {
  it('formats the number with no unit when none is given', () => {
    expect(formatQuantity(12.5, { locale: 'en-US' })).toBe('12.5')
  })

  it('appends the unit label when provided', () => {
    // joined with a non-breaking space (U+00A0); normalise before comparing
    const out = formatQuantity(12.5, { locale: 'en-US', unit: 'kg' }).replace(/\s/gu, ' ')
    expect(out).toBe('12.5 kg')
  })
})

describe('formatPercent', () => {
  it('treats the input as a ratio and renders a percentage', () => {
    expect(formatPercent(0.125, { locale: 'en-US' })).toBe('12.5%')
  })

  it('caps fraction digits to the requested precision', () => {
    expect(formatPercent(0.12345, { locale: 'en-US', maximumFractionDigits: 0 })).toBe('12%')
  })
})

describe('formatDate', () => {
  it('formats a date at medium style for the given locale and timezone', () => {
    expect(formatDate('2026-01-15T12:00:00Z', { locale: 'en-US', timeZone: 'UTC' })).toBe(
      'Jan 15, 2026',
    )
  })
})

describe('formatDateTime', () => {
  it('includes both date and time components', () => {
    const out = formatDateTime('2026-01-15T09:30:00Z', { locale: 'en-US', timeZone: 'UTC' })
    expect(out).toContain('2026')
    expect(out).toMatch(/9:30/)
  })
})

describe('formatRelativeLatency', () => {
  it('renders sub-millisecond, millisecond and second ranges without inline toFixed drift', () => {
    expect(formatRelativeLatency(0.4)).toBe('<1 ms')
    expect(formatRelativeLatency(42.6)).toBe('43 ms')
    expect(formatRelativeLatency(1500)).toBe('1.50 s')
  })
})
