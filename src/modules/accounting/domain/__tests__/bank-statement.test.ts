import { describe, expect, it } from 'vitest'

import { bankStatementImportRowSchema } from '../bank-statement'

describe('bankStatementImportRowSchema', () => {
  it('accepts a valid debit row', () => {
    const parsed = bankStatementImportRowSchema.safeParse({
      statement_date: '2026-09-01',
      description: 'Supplier payment',
      reference: 'REF1',
      debit: '1200',
      credit: '0',
    })
    expect(parsed.success).toBe(true)
  })

  it('rejects a malformed date', () => {
    const parsed = bankStatementImportRowSchema.safeParse({
      statement_date: '01/09/2026',
      description: 'x',
      debit: '0',
      credit: '10',
    })
    expect(parsed.success).toBe(false)
  })

  it('rejects a negative amount', () => {
    const parsed = bankStatementImportRowSchema.safeParse({
      statement_date: '2026-09-01',
      description: 'x',
      debit: '-5',
      credit: '0',
    })
    expect(parsed.success).toBe(false)
  })
})
