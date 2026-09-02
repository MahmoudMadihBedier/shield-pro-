import { describe, expect, it } from 'vitest'

import { parseLines, serializeLines } from '../line-utils'
import { transferLineSchema, type TransferLine } from '../schemas'

describe('serializeLines / parseLines', () => {
  it('round-trips a typed line list', () => {
    const lines: TransferLine[] = [
      { product_id: 'p1', qty: 2, lot_number: 'L-1' },
      { product_id: 'p2', qty: 5 },
    ]
    expect(parseLines(serializeLines(lines), transferLineSchema)).toEqual(lines)
  })

  it('parses an empty / nullish column to []', () => {
    expect(parseLines('', transferLineSchema)).toEqual([])
    expect(parseLines(null, transferLineSchema)).toEqual([])
    expect(parseLines(undefined, transferLineSchema)).toEqual([])
  })

  it('throws on malformed JSON', () => {
    expect(() => parseLines('[{bad', transferLineSchema)).toThrow(/malformed/i)
  })

  it('throws when a row fails the schema', () => {
    expect(() => parseLines('[{"product_id":"p1","qty":0}]', transferLineSchema)).toThrow(
      /validation/i,
    )
  })
})
