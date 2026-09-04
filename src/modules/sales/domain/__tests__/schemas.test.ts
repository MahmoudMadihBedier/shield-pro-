import { describe, expect, it } from 'vitest'

import {
  closeoutActualSchema,
  closeoutExpectedSchema,
  invoiceLineSchema,
  parseCloseoutExpected,
  parseInvoiceLines,
  parseJsonArray,
  repIssueLineSchema,
  serializeJsonArray,
} from '../schemas'

describe('invoiceLineSchema', () => {
  it('accepts a well-formed priced line', () => {
    const line = { product_id: 'p1', qty: 3, base_price: 100, discount_pct: 10, net_price: 90 }
    expect(invoiceLineSchema.parse(line)).toEqual(line)
  })

  it('rejects a non-positive qty', () => {
    expect(
      invoiceLineSchema.safeParse({
        product_id: 'p1',
        qty: 0,
        base_price: 100,
        discount_pct: 0,
        net_price: 100,
      }).success,
    ).toBe(false)
  })

  it('rejects a discount over 100%', () => {
    expect(
      invoiceLineSchema.safeParse({
        product_id: 'p1',
        qty: 1,
        base_price: 100,
        discount_pct: 120,
        net_price: 0,
      }).success,
    ).toBe(false)
  })
})

describe('repIssueLineSchema', () => {
  it('accepts a line with an optional lot number', () => {
    expect(repIssueLineSchema.parse({ product_id: 'p1', qty: 5 })).toEqual({
      product_id: 'p1',
      qty: 5,
    })
  })

  it('rejects a negative qty', () => {
    expect(repIssueLineSchema.safeParse({ product_id: 'p1', qty: -1 }).success).toBe(false)
  })
})

describe('closeout bags', () => {
  it('accepts an expected bag with product + cash rows', () => {
    const bag = {
      products: [{ product_id: 'p1', issued: 10, sold: 6, returned: 1, remaining: 3 }],
      cash: [{ method: 'cash' as const, amount: 600 }],
    }
    expect(closeoutExpectedSchema.parse(bag)).toEqual(bag)
  })

  it('rejects an unknown cash method', () => {
    expect(
      closeoutActualSchema.safeParse({
        products: [],
        cash: [{ method: 'crypto', amount: 1 }],
      }).success,
    ).toBe(false)
  })
})

describe('JSON column helpers', () => {
  it('round-trips a line array', () => {
    const lines = [{ product_id: 'p1', qty: 2, base_price: 50, discount_pct: 0, net_price: 50 }]
    expect(parseInvoiceLines(serializeJsonArray(lines))).toEqual(lines)
  })

  it('treats an empty column as an empty list', () => {
    expect(parseJsonArray('', invoiceLineSchema)).toEqual([])
    expect(parseJsonArray(null, invoiceLineSchema)).toEqual([])
  })

  it('throws on malformed JSON', () => {
    expect(() => parseJsonArray('{not json', invoiceLineSchema)).toThrow()
  })

  it('parseCloseoutExpected returns null for an absent column', () => {
    expect(parseCloseoutExpected(null)).toBeNull()
  })
})
