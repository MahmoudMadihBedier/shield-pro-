import { describe, expect, it } from 'vitest'

import { assertBalanced } from '@/core/ledger'

import { GlAccount, receiptToGlLines, trialBalance, voucherToGlLines } from '../gl'

describe('receiptToGlLines', () => {
  it('debits cash for a cash receipt and credits AR — balanced', () => {
    const lines = receiptToGlLines({ amount: 250, method: 'cash' })
    expect(lines).toEqual([
      { account: GlAccount.Cash, debit: 250, credit: 0 },
      { account: GlAccount.AccountsReceivable, debit: 0, credit: 250 },
    ])
    expect(() => assertBalanced(lines)).not.toThrow()
  })

  it('debits bank for a non-cash receipt', () => {
    expect(receiptToGlLines({ amount: 10, method: 'bank_transfer' })[0]?.account).toBe(
      GlAccount.Bank,
    )
    expect(receiptToGlLines({ amount: 10, method: 'post_dated_cheque' })[0]?.account).toBe(
      GlAccount.Bank,
    )
  })
})

describe('voucherToGlLines', () => {
  it('receipt direction: Dr treasury / Cr other — balanced', () => {
    const lines = voucherToGlLines({ direction: 'receipt', amount: 500, treasury_account: null })
    expect(lines).toEqual([
      { account: GlAccount.Treasury, debit: 500, credit: 0 },
      { account: GlAccount.Other, debit: 0, credit: 500 },
    ])
    expect(() => assertBalanced(lines)).not.toThrow()
  })

  it('payment direction: Dr expense / Cr treasury — balanced', () => {
    const lines = voucherToGlLines({ direction: 'payment', amount: 500, treasury_account: null })
    expect(lines).toEqual([
      { account: GlAccount.Expense, debit: 500, credit: 0 },
      { account: GlAccount.Treasury, debit: 0, credit: 500 },
    ])
    expect(() => assertBalanced(lines)).not.toThrow()
  })

  it('uses a supplied treasury_account verbatim', () => {
    const lines = voucherToGlLines({
      direction: 'payment',
      amount: 5,
      treasury_account: 'petty_cash',
    })
    expect(lines[1]?.account).toBe('petty_cash')
  })
})

describe('trialBalance', () => {
  it('folds rows per account, sorts, totals and reports balanced', () => {
    const tb = trialBalance([
      { account: 'cash', debit: 250, credit: 0 },
      { account: 'accounts_receivable', debit: 0, credit: 250 },
      { account: 'cash', debit: 100, credit: 0 },
      { account: 'income', debit: 0, credit: 100 },
    ])
    expect(tb.rows.map((r) => r.account)).toEqual(['accounts_receivable', 'cash', 'income'])
    expect(tb.rows.find((r) => r.account === 'cash')).toMatchObject({ debit: 350, balance: 350 })
    expect(tb.totalDebit).toBe(350)
    expect(tb.totalCredit).toBe(350)
    expect(tb.balanced).toBe(true)
  })

  it('skips cancelled rows and can report out-of-balance', () => {
    const tb = trialBalance([
      { account: 'cash', debit: 100, credit: 0 },
      { account: 'income', debit: 0, credit: 100, is_cancelled: true },
    ])
    expect(tb.rows).toHaveLength(1)
    expect(tb.totalDebit).toBe(100)
    expect(tb.totalCredit).toBe(0)
    expect(tb.balanced).toBe(false)
  })
})
