import { describe, expect, it } from 'vitest'

import {
  parseReturnLines,
  returnLineSchema,
  returnRequestDraftSchema,
  returnRequestRowSchema,
  serializeReturnLines,
  RETURN_STATUSES,
  type ReturnLine,
} from '../schemas'

const envelope = {
  $id: 'row-1',
  $createdAt: '2026-08-30T10:00:00.000Z',
  $updatedAt: '2026-08-30T10:00:00.000Z',
  reference_id: 'RET-2026-00001',
  doc_status: 0,
  created_by: 'user-1',
  posting_datetime: '2026-08-30T10:00:00.000Z',
}

describe('returnLineSchema', () => {
  it('accepts a positive qty with an optional reason detail', () => {
    expect(returnLineSchema.parse({ product_id: 'p1', qty: 3 })).toEqual({
      product_id: 'p1',
      qty: 3,
    })
    expect(
      returnLineSchema.parse({ product_id: 'p1', qty: 3, reason_detail: 'damaged box' })
        .reason_detail,
    ).toBe('damaged box')
  })

  it('rejects a zero / negative qty', () => {
    expect(returnLineSchema.safeParse({ product_id: 'p1', qty: 0 }).success).toBe(false)
    expect(returnLineSchema.safeParse({ product_id: 'p1', qty: -1 }).success).toBe(false)
  })
})

describe('RETURN_STATUSES', () => {
  it('is the schema tuple', () => {
    expect(RETURN_STATUSES).toEqual(['pending', 'approved', 'rejected'])
  })
})

describe('returnRequestRowSchema', () => {
  it('parses a full row and keeps `lines` as a raw string', () => {
    const row = returnRequestRowSchema.parse({
      ...envelope,
      origin_ref: 'INV-2026-00042',
      lines: '[{"product_id":"p1","qty":2}]',
      reason: 'customer changed mind',
      status: 'pending',
      requested_by: 'user-1',
      approved_by: null,
    })
    expect(row.status).toBe('pending')
    expect(typeof row.lines).toBe('string')
  })

  it('rejects an unknown status', () => {
    expect(
      returnRequestRowSchema.safeParse({
        ...envelope,
        origin_ref: 'INV-2026-00042',
        lines: '[]',
        reason: 'x',
        status: 'closed',
      }).success,
    ).toBe(false)
  })

  it('rejects an out-of-range doc_status', () => {
    expect(
      returnRequestRowSchema.safeParse({
        ...envelope,
        doc_status: 5,
        origin_ref: 'INV-2026-00042',
        lines: '[]',
        reason: 'x',
        status: 'pending',
      }).success,
    ).toBe(false)
  })

  it('requires origin_ref', () => {
    expect(
      returnRequestRowSchema.safeParse({
        ...envelope,
        lines: '[]',
        reason: 'x',
        status: 'pending',
      }).success,
    ).toBe(false)
  })
})

describe('returnRequestDraftSchema', () => {
  it('accepts an origin ref, reason and at least one line', () => {
    expect(
      returnRequestDraftSchema.safeParse({
        origin_ref: 'INV-2026-00042',
        reason: 'damaged in transit',
        lines: [{ product_id: 'p1', qty: 2 }],
      }).success,
    ).toBe(true)
  })

  it('rejects an empty line list', () => {
    expect(
      returnRequestDraftSchema.safeParse({
        origin_ref: 'INV-2026-00042',
        reason: 'damaged in transit',
        lines: [],
      }).success,
    ).toBe(false)
  })

  it('rejects a blank origin_ref', () => {
    expect(
      returnRequestDraftSchema.safeParse({
        origin_ref: '   ',
        reason: 'damaged in transit',
        lines: [{ product_id: 'p1', qty: 2 }],
      }).success,
    ).toBe(false)
  })

  it('requires a non-empty reason', () => {
    expect(
      returnRequestDraftSchema.safeParse({
        origin_ref: 'INV-2026-00042',
        reason: '   ',
        lines: [{ product_id: 'p1', qty: 2 }],
      }).success,
    ).toBe(false)
  })
})

describe('serializeReturnLines / parseReturnLines', () => {
  it('round-trips a line list', () => {
    const lines: ReturnLine[] = [
      { product_id: 'p1', qty: 2 },
      { product_id: 'p2', qty: 1, reason_detail: 'wrong item' },
    ]
    expect(parseReturnLines(serializeReturnLines(lines))).toEqual(lines)
  })

  it('treats an absent / empty column as an empty list', () => {
    expect(parseReturnLines(null)).toEqual([])
    expect(parseReturnLines(undefined)).toEqual([])
    expect(parseReturnLines('')).toEqual([])
  })

  it('throws on malformed JSON', () => {
    expect(() => parseReturnLines('{not json')).toThrow()
  })

  it('throws when a line fails validation', () => {
    expect(() => parseReturnLines('[{"product_id":"p1","qty":-1}]')).toThrow()
  })
})
