import { describe, expect, it } from 'vitest'

import { formatReferenceId, isReferenceId, parseReferenceId } from '../reference-id'

describe('formatReferenceId', () => {
  it('formats prefix, year and zero-padded sequence', () => {
    expect(formatReferenceId('SalesInvoice', 42, 2026)).toBe('INV-2026-00042')
    expect(formatReferenceId('ProductionBatch', 1, 2026)).toBe('BATCH-2026-00001')
  })

  it('does not truncate sequences longer than the pad width', () => {
    expect(formatReferenceId('SalesInvoice', 123456, 2026)).toBe('INV-2026-123456')
  })

  it('rejects non-positive or non-integer sequences', () => {
    expect(() => formatReferenceId('SalesInvoice', 0, 2026)).toThrow()
    expect(() => formatReferenceId('SalesInvoice', -1, 2026)).toThrow()
    expect(() => formatReferenceId('SalesInvoice', 1.5, 2026)).toThrow()
  })
})

describe('parseReferenceId', () => {
  it('round-trips a formatted id', () => {
    const id = formatReferenceId('WarehouseTransfer', 7, 2026)
    expect(parseReferenceId(id)).toEqual({ prefix: 'TRF', year: 2026, sequence: 7 })
  })

  it('returns null for unknown prefixes or malformed input', () => {
    expect(parseReferenceId('XYZ-2026-00001')).toBeNull()
    expect(parseReferenceId('not-an-id')).toBeNull()
    expect(parseReferenceId('INV-26-1')).toBeNull()
  })
})

describe('isReferenceId', () => {
  it('accepts valid ids and rejects everything else', () => {
    expect(isReferenceId('REC-2026-00010')).toBe(true)
    expect(isReferenceId('random text')).toBe(false)
  })
})
