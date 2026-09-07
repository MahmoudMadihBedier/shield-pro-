import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { recordsToSheet } from '@/core/xlsx'

import { buildXlsx } from '../xlsx'

describe('buildXlsx', () => {
  const bytes = buildXlsx([
    recordsToSheet('customers', [
      { id: 'c1', name: 'شركة النور', balance: 1200.5 },
      { id: 'c2', name: 'Acme <Ltd>', balance: 0 },
    ]),
    recordsToSheet('branches', [{ id: 'b1', name: 'منوف' }]),
  ])

  it('produces a real ZIP (PK magic bytes)', () => {
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
  })

  it('contains the OPC parts and one worksheet per table', () => {
    const files = Object.keys(unzipSync(bytes))
    expect(files).toContain('[Content_Types].xml')
    expect(files).toContain('xl/workbook.xml')
    expect(files).toContain('xl/worksheets/sheet1.xml')
    expect(files).toContain('xl/worksheets/sheet2.xml')
  })

  it('writes numbers as numeric cells and escapes strings', () => {
    const unzipped = unzipSync(bytes)
    const sheet1 = strFromU8(unzipped['xl/worksheets/sheet1.xml']!)
    expect(sheet1).toContain('<v>1200.5</v>')
    expect(sheet1).toContain('Acme &lt;Ltd&gt;')
    expect(sheet1).toContain('شركة النور')
  })
})
