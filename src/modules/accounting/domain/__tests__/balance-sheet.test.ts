import { describe, expect, it } from 'vitest'

import { buildBalanceSheet, type BalanceSheet } from '../balance-sheet'
import type { TrialBalanceAccount } from '../gl'

/**
 * Worked example, four postings:
 *   1. Capital contribution:  Dr cash 5000            / Cr owners_capital 5000
 *   2. Capital withdrawal:    Dr owners_drawings 1000  / Cr cash 1000
 *   3. Cash sale:             Dr cash 300               / Cr sales_revenue 300
 *   4. Cash expense:          Dr expense 50              / Cr cash 50
 *
 * Resulting account balances (debit − credit):
 *   cash              = 5000 - 1000 + 300 - 50 = 4250   (asset)
 *   owners_capital    = -5000                            (equity)
 *   owners_drawings   = +1000                             (equity)
 *   sales_revenue     = -300                              (income — off the sheet)
 *   expense           = +50                                (expense — off the sheet)
 * netIncome = 300 - 50 = 250
 */
function rows(): TrialBalanceAccount[] {
  return [
    { account: 'cash', debit: 5300, credit: 1050, balance: 4250, accountType: 'asset' },
    { account: 'owners_capital', debit: 0, credit: 5000, balance: -5000, accountType: 'equity' },
    { account: 'owners_drawings', debit: 1000, credit: 0, balance: 1000, accountType: 'equity' },
    { account: 'sales_revenue', debit: 0, credit: 300, balance: -300, accountType: 'income' },
    { account: 'expense', debit: 50, credit: 0, balance: 50, accountType: 'expense' },
  ]
}

describe('buildBalanceSheet', () => {
  let sheet: BalanceSheet

  it('classifies each account into the right section by accountType', () => {
    sheet = buildBalanceSheet(rows(), 250, '2026-09-22')
    expect(sheet.assets.lines).toEqual([{ account: 'cash', amount: 4250 }])
    expect(sheet.capital.lines).toEqual([
      { account: 'owners_capital', amount: 5000 },
      { account: 'owners_drawings', amount: -1000 },
    ])
    expect(sheet.liabilities.lines).toEqual([])
  })

  it('folds net income in as retained earnings, separate from posted capital', () => {
    expect(sheet.retainedEarnings).toBe(250)
    expect(sheet.capital.total).toBe(4000) // 5000 contributed - 1000 withdrawn
    expect(sheet.totalEquity).toBe(4250) // 4000 + 250 retained earnings
  })

  it('balances: Assets = Liabilities + Equity', () => {
    expect(sheet.assets.total).toBe(4250)
    expect(sheet.totalLiabilitiesAndEquity).toBe(4250)
    expect(sheet.balanced).toBe(true)
  })

  it('excludes income/expense accounts from every section directly', () => {
    const allLines = [...sheet.assets.lines, ...sheet.liabilities.lines, ...sheet.capital.lines]
    expect(allLines.some((l) => l.account === 'sales_revenue' || l.account === 'expense')).toBe(
      false,
    )
  })

  it('reports a liability with the natural positive-owed sign', () => {
    const withPayable = buildBalanceSheet(
      [
        { account: 'cash', debit: 1000, credit: 0, balance: 1000, accountType: 'asset' },
        {
          account: 'accounts_payable',
          debit: 0,
          credit: 400,
          balance: -400,
          accountType: 'liability',
        },
        { account: 'owners_capital', debit: 0, credit: 600, balance: -600, accountType: 'equity' },
      ],
      0,
      '2026-09-22',
    )
    expect(withPayable.liabilities.lines).toEqual([{ account: 'accounts_payable', amount: 400 }])
    expect(withPayable.balanced).toBe(true) // 1000 = 400 + 600
  })

  it('flags an out-of-balance sheet rather than silently accepting it', () => {
    const broken = buildBalanceSheet(
      [{ account: 'cash', debit: 100, credit: 0, balance: 100, accountType: 'asset' }],
      0,
      '2026-09-22',
    )
    // no offsetting liability/equity/income posted — assets (100) != 0
    expect(broken.balanced).toBe(false)
  })

  it('drops a near-zero line within ledger tolerance', () => {
    const tiny = buildBalanceSheet(
      [{ account: 'cash', debit: 0.0000001, credit: 0, balance: 0.0000001, accountType: 'asset' }],
      0,
      '2026-09-22',
    )
    expect(tiny.assets.lines).toEqual([])
  })

  it('ignores an account with no accountType (not yet in the chart)', () => {
    const unknown = buildBalanceSheet(
      [{ account: 'mystery', debit: 100, credit: 0, balance: 100, accountType: undefined }],
      0,
      '2026-09-22',
    )
    expect(unknown.assets.lines).toEqual([])
    expect(unknown.liabilities.lines).toEqual([])
    expect(unknown.capital.lines).toEqual([])
  })
})
