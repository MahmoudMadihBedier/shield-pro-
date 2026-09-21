import { describe, expect, it } from 'vitest'

import { assertBalanced } from '@/core/ledger'

import {
  GlAccount,
  netOwnersEquity,
  receiptToGlLines,
  trialBalance,
  voucherToGlLines,
  withdrawalToGlLines,
} from '../gl'

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

describe('withdrawalToGlLines', () => {
  it('debits owners drawings and credits the source account — balanced', () => {
    const lines = withdrawalToGlLines({ amount: 1000, source_account: 'cash' })
    expect(lines).toEqual([
      { account: GlAccount.OwnersDrawings, debit: 1000, credit: 0 },
      { account: 'cash', debit: 0, credit: 1000 },
    ])
    expect(() => assertBalanced(lines)).not.toThrow()
  })

  it('falls back to Cash when source_account is blank', () => {
    const lines = withdrawalToGlLines({ amount: 50, source_account: '   ' })
    expect(lines[1]?.account).toBe(GlAccount.Cash)
  })

  it('never touches OwnersCapital directly', () => {
    const lines = withdrawalToGlLines({ amount: 300, source_account: 'bank' })
    expect(lines.some((l) => l.account === GlAccount.OwnersCapital)).toBe(false)
  })
})

describe('netOwnersEquity', () => {
  it('nets capital contributed against drawings taken out', () => {
    // Dr cash 5000 / Cr owners_capital 5000 -> capital account balance = -5000
    // Dr owners_drawings 1000 / Cr cash 1000 -> drawings account balance = +1000
    expect(netOwnersEquity(-5000, 1000)).toBe(4000)
  })

  it('is zero when neither account has postings', () => {
    expect(netOwnersEquity(0, 0)).toBe(0)
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
