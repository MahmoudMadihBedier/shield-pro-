import { describe, expect, it } from 'vitest'

import { columnLetter, escapeXml, recordsToSheet, sanitizeSheetName, xlsxParts } from '../xlsx'

describe('columnLetter', () => {
  it('maps 0-based indexes to spreadsheet labels', () => {
    expect(columnLetter(0)).toBe('A')
    expect(columnLetter(25)).toBe('Z')
    expect(columnLetter(26)).toBe('AA')
    expect(columnLetter(51)).toBe('AZ')
    expect(columnLetter(701)).toBe('ZZ')
    expect(columnLetter(702)).toBe('AAA')
  })
})

describe('escapeXml', () => {
  it('escapes the five XML metacharacters', () => {
    expect(escapeXml(`a & b < c > d " e ' f`)).toBe('a &amp; b &lt; c &gt; d &quot; e &apos; f')
  })

  it('keeps tab / newline / CR but drops other control characters', () => {
    const raw = `keep\tthis\nand\rthis${String.fromCharCode(0)}${String.fromCharCode(7)}drop`
    expect(escapeXml(raw)).toBe('keep\tthis\nand\rthisdrop')
  })
})

describe('sanitizeSheetName', () => {
  it('strips forbidden characters and clamps to 31 chars', () => {
    const taken = new Set<string>()
    expect(sanitizeSheetName('a/b:c*?[d]', taken)).toBe('a_b_c___d_')
    expect(sanitizeSheetName('x'.repeat(50), taken)).toHaveLength(31)
  })

  it('de-duplicates case-insensitively', () => {
    const taken = new Set<string>()
    expect(sanitizeSheetName('customers', taken)).toBe('customers')
    expect(sanitizeSheetName('Customers', taken)).toBe('Customers_2')
    expect(sanitizeSheetName('customers', taken)).toBe('customers_3')
  })
})

describe('recordsToSheet', () => {
  it('derives the column union in first-seen order and coerces values', () => {
    const sheet = recordsToSheet('t', [
      { id: '1', name: 'A', tags: ['x', 'y'] },
      { id: '2', extra: 3, name: 'B' },
    ])
    expect(sheet.columns).toEqual(['id', 'name', 'tags', 'extra'])
    expect(sheet.rows[0]).toEqual({ id: '1', name: 'A', tags: '["x","y"]', extra: '' })
    expect(sheet.rows[1]).toEqual({ id: '2', name: 'B', tags: '', extra: 3 })
  })

  it('honours an explicit column list and omitKey', () => {
    const sheet = recordsToSheet('t', [{ id: '1', $secret: 'no', keep: 'yes' }], {
      columns: ['keep', 'id', '$secret'],
      omitKey: (k) => k.startsWith('$'),
    })
    expect(sheet.columns).toEqual(['keep', 'id'])
  })
})

describe('xlsxParts', () => {
  it('emits the OPC skeleton plus one worksheet per sheet', () => {
    const parts = xlsxParts([
      recordsToSheet('one', [{ a: 1 }]),
      recordsToSheet('two', [{ b: 'hi' }]),
    ])
    expect(Object.keys(parts).sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/_rels/workbook.xml.rels',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
        'xl/worksheets/sheet2.xml',
      ].sort(),
    )
    expect(parts['xl/workbook.xml']).toContain('name="one"')
    expect(parts['xl/worksheets/sheet1.xml']).toContain('<v>1</v>')
    expect(parts['xl/worksheets/sheet2.xml']).toContain('>hi<')
  })

  it('always produces at least one sheet', () => {
    const parts = xlsxParts([])
    expect(parts['xl/worksheets/sheet1.xml']).toBeDefined()
  })
})
