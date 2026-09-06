import { describe, expect, it } from 'vitest'

import { parseCsv, toCsv, type CsvColumn } from '../csv'

describe('parseCsv', () => {
  it('keys each row by the header and trims cells', () => {
    expect(parseCsv('code, purchase_price\r\n A1 ,150\nB2,0.5')).toEqual([
      { code: 'A1', purchase_price: '150' },
      { code: 'B2', purchase_price: '0.5' },
    ])
  })

  it('handles quoted fields with commas, embedded quotes and newlines', () => {
    const rows = parseCsv('name,note\r\n"Ali, A","say ""hi""\nline2"\r\n')
    expect(rows).toEqual([{ name: 'Ali, A', note: 'say "hi"\nline2' }])
  })

  it('strips a leading UTF-8 BOM and ignores blank lines', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n\r\n')).toEqual([{ a: '1', b: '2' }])
  })

  it('returns [] for empty / header-only input', () => {
    expect(parseCsv('')).toEqual([])
    expect(parseCsv('a,b')).toEqual([])
  })

  it('round-trips with toCsv', () => {
    const columns: CsvColumn[] = [
      { key: 'code', header: 'code' },
      { key: 'label', header: 'label' },
    ]
    const data = [
      { code: 'X', label: 'plain' },
      { code: 'Y', label: 'has, comma' },
      { code: 'Z', label: 'ملصق عربي' },
    ]
    expect(parseCsv(toCsv(data, columns))).toEqual(
      data.map((d) => ({ code: d.code, label: d.label })),
    )
  })
})
