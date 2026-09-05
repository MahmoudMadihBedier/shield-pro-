/**
 * Incentive-rule evaluation. `incentive_rules.predicate` is a small JSON blob
 * describing the threshold/rate for one rule `kind`; `evaluateIncentive` reads
 * it against a set of period "facts" for one employee and returns the amount
 * to add to that employee's payroll line.
 *
 * v1 note (see `PayrollLineEditor`): `facts` are entered manually per employee
 * per payroll run. Auto-computing `salesAmount` from `sales_invoices` or
 * `unitsProduced` from `production_batches` would cross the module boundary
 * (`claude.md` — hr may not import other business modules) and is a follow-up
 * once those modules expose a read-only cross-module facts API.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import { z } from 'zod'

import type { IncentiveKind } from './schemas'

/**
 * The shape stored (JSON-stringified) in `incentive_rules.predicate`. Every
 * field is optional — a rule only sets the thresholds relevant to its `kind`.
 */
export const incentivePredicateSchema = z.object({
  minSalesAmount: z.number().nonnegative().optional(),
  ratePct: z.number().min(0).max(100).optional(),
  minUnitsProduced: z.number().nonnegative().optional(),
  flatAmount: z.number().nonnegative().optional(),
  minAttendanceDays: z.number().nonnegative().optional(),
})
export type IncentivePredicate = z.infer<typeof incentivePredicateSchema>

/** Parse a `predicate` JSON string; an absent/empty/malformed column is `{}`. */
export function parseIncentivePredicate(raw: string | null | undefined): IncentivePredicate {
  if (raw == null || raw.trim() === '') return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  const result = incentivePredicateSchema.safeParse(parsed)
  return result.success ? result.data : {}
}

export function serializeIncentivePredicate(predicate: IncentivePredicate): string {
  return JSON.stringify(predicate)
}

/** Per-employee, per-period measurements an incentive rule may be evaluated against. */
export interface IncentiveFacts {
  salesAmount?: number
  unitsProduced?: number
  attendanceDays?: number
}

export interface IncentiveRuleLike {
  kind: IncentiveKind
  predicate: IncentivePredicate
  amountOrPct: number
  /** Defaults to `true` — an inactive rule always contributes 0. */
  isActive?: boolean
}

/** Build an `IncentiveRuleLike` from a raw `incentive_rules` row shape. */
export function toIncentiveRuleLike(row: {
  kind: IncentiveKind
  predicate?: string | null
  amount_or_pct: number
  is_active: boolean
}): IncentiveRuleLike {
  return {
    kind: row.kind,
    predicate: parseIncentivePredicate(row.predicate),
    amountOrPct: row.amount_or_pct,
    isActive: row.is_active,
  }
}

/**
 * The incentive amount this rule contributes for one employee's facts, or 0
 * when the rule's threshold isn't met.
 *
 *  - `sales_commission`: facts.salesAmount ≥ predicate.minSalesAmount (default 0)
 *    → `salesAmount * (predicate.ratePct ?? amountOrPct) / 100`.
 *  - `production_bonus`: facts.unitsProduced ≥ predicate.minUnitsProduced
 *    → flat `predicate.flatAmount ?? amountOrPct`.
 *  - `attendance_bonus`: facts.attendanceDays ≥ predicate.minAttendanceDays
 *    → flat `predicate.flatAmount ?? amountOrPct`.
 */
export function evaluateIncentive(rule: IncentiveRuleLike, facts: IncentiveFacts): number {
  const { kind, predicate, amountOrPct, isActive = true } = rule
  if (!isActive) return 0

  switch (kind) {
    case 'sales_commission': {
      const sales = facts.salesAmount ?? 0
      const minSales = predicate.minSalesAmount ?? 0
      if (sales < minSales) return 0
      const rate = predicate.ratePct ?? amountOrPct
      return sales * (rate / 100)
    }
    case 'production_bonus': {
      const units = facts.unitsProduced ?? 0
      const minUnits = predicate.minUnitsProduced ?? 0
      if (units < minUnits) return 0
      return predicate.flatAmount ?? amountOrPct
    }
    case 'attendance_bonus': {
      const days = facts.attendanceDays ?? 0
      const minDays = predicate.minAttendanceDays ?? 0
      if (days < minDays) return 0
      return predicate.flatAmount ?? amountOrPct
    }
    default:
      return 0
  }
}
