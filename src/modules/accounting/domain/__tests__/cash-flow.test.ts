import { describe, expect, it } from 'vitest'

import { buildCashFlowStatement } from '../cash-flow'

describe('buildCashFlowStatement', () => {
  /**
   * Worked example, five postings over the period, hand-verified against the
   * actual cash movement:
   *   1. Cash sale:                 Dr cash 300           / Cr sales_revenue 300
   *   2. Credit sale:                Dr AR 400              / Cr sales_revenue 400
   *   3. Collect old AR:              Dr cash 200            / Cr AR 200
   *   4. Cash expense:                Dr expense 150          / Cr cash 150
   *   5. Expense on credit (unpaid): Dr expense 100          / Cr accounts_payable 100
   *
   * netIncome = revenue(300+400) - expense(150+100) = 450
   * AR: 1000 -> +400 -200 -> 1200            => accountsReceivableChange = +200
   * AP: 500 owed -> +100 more owed -> 600     => accountsPayableChange   = +100
   * Actual cash effect: +300 +200 -150 = +350 (the credit sale and the
   * credit-purchased expense never touch cash at all)
   */
  it('reconstructs the actual cash movement from net income + working-capital deltas', () => {
    const cf = buildCashFlowStatement({
      netIncome: 450,
      accountsReceivableChange: 200,
      accountsPayableChange: 100,
      capitalContributed: 0,
      capitalWithdrawn: 0,
      cashBeginning: 2000,
      cashEnding: 2350,
    })

    expect(cf.operatingActivities).toBe(350) // matches the hand-computed actual cash effect
    expect(cf.investingActivities).toBe(0)
    expect(cf.financingActivities).toBe(0)
    expect(cf.netChangeInCash).toBe(350)
    expect(cf.computedCashEnding).toBe(2350)
    expect(cf.reconciles).toBe(true)
  })

  it('an AR increase reduces operating cash flow (revenue recognized, not collected)', () => {
    const cf = buildCashFlowStatement({
      netIncome: 100,
      accountsReceivableChange: 100, // all of it is uncollected credit sales
      accountsPayableChange: 0,
      capitalContributed: 0,
      capitalWithdrawn: 0,
      cashBeginning: 0,
      cashEnding: 0,
    })
    expect(cf.operatingActivities).toBe(0) // 100 net income, fully offset by uncollected AR
  })

  it('an AP increase adds back to operating cash flow (expense recognized, not paid)', () => {
    const cf = buildCashFlowStatement({
      netIncome: -100, // an unpaid expense reduced net income
      accountsReceivableChange: 0,
      accountsPayableChange: 100, // but no cash left, since it's unpaid
      capitalContributed: 0,
      capitalWithdrawn: 0,
      cashBeginning: 0,
      cashEnding: 0,
    })
    expect(cf.operatingActivities).toBe(0) // -100 net income, fully offset by the unpaid AP
  })

  it('financing = cash-settled capital contributed minus withdrawn, ties to the capital work', () => {
    const cf = buildCashFlowStatement({
      netIncome: 0,
      accountsReceivableChange: 0,
      accountsPayableChange: 0,
      capitalContributed: 5000,
      capitalWithdrawn: 1200,
      cashBeginning: 0,
      cashEnding: 3800,
    })
    expect(cf.financingActivities).toBe(3800)
    expect(cf.netChangeInCash).toBe(3800)
    expect(cf.reconciles).toBe(true)
  })

  it('flags a non-reconciling statement instead of silently accepting it', () => {
    const cf = buildCashFlowStatement({
      netIncome: 100,
      accountsReceivableChange: 0,
      accountsPayableChange: 0,
      capitalContributed: 0,
      capitalWithdrawn: 0,
      cashBeginning: 0,
      cashEnding: 999, // doesn't match computed 100 — e.g. an untracked cash movement
    })
    expect(cf.reconciles).toBe(false)
  })
})
