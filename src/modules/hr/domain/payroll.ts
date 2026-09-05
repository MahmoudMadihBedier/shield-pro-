/**
 * Pure payroll-line maths — no framework imports, independently testable.
 *
 * `domain` is pure TypeScript (`claude.md` B.4).
 */
import { z } from 'zod'

import { evaluateIncentive, type IncentiveFacts, type IncentiveRuleLike } from './incentives'
import { payrollLineSchema, type PayrollLine } from './schemas'

/**
 * Net pay for one employee: `base + incentives - deductions`, clamped at 0.
 * A payroll line never carries a negative net pay — if deductions exceed
 * earnings the employee is paid 0, not a negative amount (the shortfall is a
 * separate HR/accounting matter, out of scope for this calculation).
 */
export function computeNetPay(baseSalary: number, incentives: number, deductions: number): number {
  const net = baseSalary + incentives - deductions
  return net > 0 ? net : 0
}

/** One employee's inputs when assembling a payroll run's `lines`. */
export interface PayrollEmployeeInput {
  userId: string
  baseSalary: number
}

/**
 * Build the typed `PayrollLine[]` for a payroll run from the employee roster
 * plus per-employee incentive/deduction totals for the period. An employee
 * absent from `incentivesByUser` / `deductionsByUser` defaults to 0.
 */
export function buildPayrollLines(
  employees: readonly PayrollEmployeeInput[],
  incentivesByUser: ReadonlyMap<string, number>,
  deductionsByUser: ReadonlyMap<string, number>,
): PayrollLine[] {
  return employees.map(({ userId, baseSalary }) => {
    const incentives = incentivesByUser.get(userId) ?? 0
    const deductions = deductionsByUser.get(userId) ?? 0
    return {
      user_id: userId,
      base_salary: baseSalary,
      incentives,
      deductions,
      net_pay: computeNetPay(baseSalary, incentives, deductions),
    }
  })
}

/** One employee's inputs for `PayrollLineEditor`: facts + a manual deduction. */
export interface PayrollFactsInput {
  userId: string
  baseSalary: number
  facts: IncentiveFacts
  deductions: number
}

/**
 * Build `PayrollLine[]` from per-employee facts, evaluating every rule against
 * each employee's facts and summing the result into that line's `incentives`
 * (`domain/incentives.ts` — an inactive rule always contributes 0).
 */
export function buildPayrollLinesFromFacts(
  rows: readonly PayrollFactsInput[],
  incentiveRules: readonly IncentiveRuleLike[],
): PayrollLine[] {
  return rows.map((row) => {
    const incentives = incentiveRules.reduce((sum, rule) => sum + evaluateIncentive(rule, row.facts), 0)
    return {
      user_id: row.userId,
      base_salary: row.baseSalary,
      incentives,
      deductions: row.deductions,
      net_pay: computeNetPay(row.baseSalary, incentives, row.deductions),
    }
  })
}

/** Sum of `net_pay` across every line — the run's `total_net_pay`. */
export function payrollTotal(lines: readonly PayrollLine[]): number {
  return lines.reduce((sum, line) => sum + line.net_pay, 0)
}

/** Serialise a `PayrollLine[]` to the JSON string stored in `payroll_runs.lines`. */
export function serializePayrollLines(lines: readonly PayrollLine[]): string {
  return JSON.stringify(lines)
}

/** Parse + validate `payroll_runs.lines`. An absent/empty column is an empty list. */
export function parsePayrollLines(raw: string | null | undefined): PayrollLine[] {
  if (raw == null || raw.trim() === '') return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('hr: payroll lines column holds malformed JSON')
  }

  const result = z.array(payrollLineSchema).safeParse(parsed)
  if (!result.success) {
    throw new Error(`hr: payroll lines column failed validation — ${result.error.message}`)
  }
  return result.data
}
