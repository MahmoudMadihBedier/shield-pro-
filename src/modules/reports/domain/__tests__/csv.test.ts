import { describe, expect, it } from 'vitest'

import { toCsv } from '../csv'

const columns = [
  { key: 'name', header: 'الاسم' },
  { key: 'amount', header: 'Amount' },
]

describe('toCsv', () => {
  it('renders a header row and one row per record, CRLF-joined', () => {
    const csv = toCsv([{ name: 'Ali', amount: 100 }], columns)
    expect(csv).toBe('الاسم,Amount\r\nAli,100')
  })

  it('renders only the header row for empty input', () => {
    expect(toCsv([], columns)).toBe('الاسم,Amount')
  })

  it('quotes a field containing a comma', () => {
    const csv = toCsv([{ name: 'Ali, Sons', amount: 1 }], columns)
    expect(csv).toContain('"Ali, Sons"')
  })

  it('quotes a field containing a newline', () => {
    const csv = toCsv([{ name: 'line1\nline2', amount: 1 }], columns)
    expect(csv).toContain('"line1\nline2"')
  })

  it('quotes a field containing a double quote and doubles the embedded quote', () => {
    const csv = toCsv([{ name: 'Say "hi"', amount: 1 }], columns)
    expect(csv).toContain('"Say ""hi"""')
  })

  it('leaves a missing key as an empty field', () => {
    const csv = toCsv([{ name: 'Ali' }], columns)
    expect(csv).toBe('الاسم,Amount\r\nAli,')
  })
})
