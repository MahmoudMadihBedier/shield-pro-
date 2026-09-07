import { describe, expect, it } from 'vitest'

import type { TrialBalanceAccount } from '../gl'
import { buildProfitAndLoss, classifyAccount, PnlSection, profitAndLossToRows } from '../pnl'

const tb = (account: string, balance: number): TrialBalanceAccount => ({
  account,
  debit: balance > 0 ? balance : 0,
  credit: balance < 0 ? -balance : 0,
  balance,
})

describe('classifyAccount', () => {
  it('maps the placeholder chart of accounts', () => {
    expect(classifyAccount('sales_revenue')).toBe(PnlSection.Revenue)
    expect(classifyAccount('sales_returns')).toBe(PnlSection.ContraRevenue)
    expect(classifyAccount('expense')).toBe(PnlSection.OperatingExpense)
    expect(classifyAccount('other')).toBe(PnlSection.OtherIncome)
    expect(classifyAccount('cost_of_goods_sold')).toBe(PnlSection.Cogs)
  })

  it('leaves balance-sheet / equity accounts off the statement', () => {
    for (const a of ['cash', 'bank', 'accounts_receivable', 'accounts_payable', 'owners_capital']) {
      expect(classifyAccount(a)).toBeNull()
    }
  })

  it('falls back to keyword matching for unknown accounts', () => {
    expect(classifyAccount('rental_income')).toBe(PnlSection.Revenue)
    expect(classifyAccount('marketing_expense')).toBe(PnlSection.OperatingExpense)
    expect(classifyAccount('other_income_fx')).toBe(PnlSection.OtherIncome)
    expect(classifyAccount('sales_returns_q1')).toBe(PnlSection.ContraRevenue)
    expect(classifyAccount('some_random_account')).toBeNull()
  })

  it('does NOT treat purchase-side returns / discounts received as contra-revenue', () => {
    expect(classifyAccount('purchase_returns')).toBeNull()
    expect(classifyAccount('discount_received')).toBeNull()
  })
})

describe('buildProfitAndLoss', () => {
  it('computes the running subtotals down to net profit', () => {
    // revenue 1000 (credit → balance -1000), returns 50 (debit), COGS 400,
    // opex 200, other income 30, other expense 10; cash is ignored.
    const pnl = buildProfitAndLoss([
      tb('sales_revenue', -1000),
      tb('sales_returns', 50),
      tb('cogs', 400),
      tb('expense', 200),
      tb('other', -30),
      tb('other_expense', 10),
      tb('cash', 500),
    ])

    expect(pnl.revenue.total).toBe(1000)
    expect(pnl.contraRevenue.total).toBe(50)
    expect(pnl.netRevenue).toBe(950)
    expect(pnl.cogs.total).toBe(400)
    expect(pnl.grossProfit).toBe(550)
    expect(pnl.operatingExpense.total).toBe(200)
    expect(pnl.operatingProfit).toBe(350)
    expect(pnl.netProfit).toBe(350 + 30 - 10)
    expect(pnl.netMargin).toBeCloseTo(370 / 950, 10)
  })

  it('drops near-zero lines and yields 0 margin with no revenue', () => {
    const pnl = buildProfitAndLoss([tb('sales_revenue', -1e-9), tb('expense', 100)])
    expect(pnl.revenue.lines).toHaveLength(0)
    expect(pnl.netRevenue).toBe(0)
    expect(pnl.netProfit).toBe(-100)
    expect(pnl.netMargin).toBe(0)
  })

  it('never lets a non-finite balance poison the totals', () => {
    const pnl = buildProfitAndLoss([
      tb('sales_revenue', -1000),
      { account: 'expense', debit: Number.NaN, credit: 0, balance: Number.NaN },
    ])
    expect(pnl.operatingExpense.lines).toHaveLength(0)
    expect(Number.isFinite(pnl.netProfit)).toBe(true)
    expect(pnl.netProfit).toBe(1000)
  })
})

describe('profitAndLossToRows', () => {
  it('emits deduction sections negative so the column foots to each subtotal', () => {
    const rows = profitAndLossToRows(
      buildProfitAndLoss([tb('sales_revenue', -1000), tb('sales_returns', 50), tb('expense', 200)]),
    )
    expect(rows).toContainEqual({ section: 'revenue', account: 'sales_revenue', amount: 1000 })
    expect(rows).toContainEqual({
      section: 'contra_revenue',
      account: 'sales_returns',
      amount: -50,
    })
    expect(rows).toContainEqual({ section: 'operating_expense', account: 'expense', amount: -200 })
    expect(rows).toContainEqual({ section: 'net_revenue', account: '', amount: 950 })
    expect(rows).toContainEqual({ section: 'net_profit', account: '', amount: 750 })
  })
})
