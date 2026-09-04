/**
 * Tiered approval engine — pure decision logic for whether a movement can be
 * auto-approved or must be routed to a human (Implementation Plan §4.5, Phase 2
 * Story 2.2).
 *
 * Business rules encoded here:
 *  - within the rep's daily-average qty × N → auto-approve;
 *  - the same actor repeating the same-ish movement more than N times inside a
 *    window → force manual review;
 *  - a new customer, an over-credit-limit request, or a price override →
 *    always manual, even under an `auto_approve` rule.
 *  - no active rule matches the movement type → fail safe to manual (a human
 *    must look at anything the rule set has no opinion on).
 *
 * `core` has ZERO framework imports — plain TypeScript + Zod only.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Predicate + context shapes
// ---------------------------------------------------------------------------

export const approvalPredicateSchema = z.object({
  /** Auto-approve while `ctx.qty <= this × ctx.repAverageQty`. */
  maxQtyMultipleOfRepAverage: z.number().positive().optional(),
  /** Force manual once `ctx.recentSameActorItemCount` exceeds this. */
  maxRepeatCount: z.number().int().positive().optional(),
  /** The window `recentSameActorItemCount` was computed over — informational
   *  for the caller that gathers the context; not consulted by `evaluateRule`. */
  repeatWindowHours: z.number().positive().optional(),
  requireManualIfNewCustomer: z.boolean().optional(),
  requireManualIfOverCreditLimit: z.boolean().optional(),
  requireManualIfPriceOverride: z.boolean().optional(),
})
export type ApprovalPredicate = z.infer<typeof approvalPredicateSchema>

/** An empty predicate matches nothing — a rule using it always falls through. */
export const EMPTY_PREDICATE: ApprovalPredicate = {}

export interface ApprovalContext {
  movementType: string
  entityRef: string
  actorId: string
  amount?: number
  qty?: number
  repAverageQty?: number
  recentSameActorItemCount?: number
  isNewCustomer?: boolean
  overCreditLimit?: boolean
  isPriceOverride?: boolean
}

export const APPROVAL_ACTIONS = ['auto_approve', 'force_manual'] as const
export type ApprovalAction = (typeof APPROVAL_ACTIONS)[number]

export interface ApprovalRuleLike {
  id: string
  movementType: string
  predicate: ApprovalPredicate
  action: ApprovalAction
  /** Lower priority number is evaluated first. */
  priority: number
  isActive: boolean
}

export interface RuleEvaluation {
  /** Does this rule fire for `ctx` at all? */
  matched: boolean
  /** When `matched`, does the predicate itself demand manual review
   *  regardless of the rule's configured `action`? */
  forcesManual: boolean
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate one rule's predicate against a context.
 *
 * The three "always manual" flags are load-bearing safety checks: whenever the
 * matching context fact is true, the rule both matches AND forces manual,
 * overriding whatever `action` the rule was configured with. The repeat-count
 * trip works the same way. The rep-average multiple is the one auto-approve
 * carve-out: the rule matches (without forcing manual) only while the
 * requested qty stays at or under `N × repAverageQty` — once it exceeds that,
 * this rule does not match, leaving the decision to a lower-priority rule or
 * the fail-safe default.
 */
export function evaluateRule(predicate: ApprovalPredicate, ctx: ApprovalContext): RuleEvaluation {
  let matched = false
  let forcesManual = false

  if (predicate.requireManualIfNewCustomer && ctx.isNewCustomer) {
    matched = true
    forcesManual = true
  }
  if (predicate.requireManualIfOverCreditLimit && ctx.overCreditLimit) {
    matched = true
    forcesManual = true
  }
  if (predicate.requireManualIfPriceOverride && ctx.isPriceOverride) {
    matched = true
    forcesManual = true
  }
  if (
    predicate.maxRepeatCount != null &&
    ctx.recentSameActorItemCount != null &&
    ctx.recentSameActorItemCount > predicate.maxRepeatCount
  ) {
    matched = true
    forcesManual = true
  }

  if (
    !forcesManual &&
    predicate.maxQtyMultipleOfRepAverage != null &&
    ctx.qty != null &&
    ctx.repAverageQty != null &&
    ctx.repAverageQty > 0 &&
    ctx.qty <= predicate.maxQtyMultipleOfRepAverage * ctx.repAverageQty
  ) {
    matched = true
  }

  return { matched, forcesManual }
}

export interface ApprovalDecision {
  action: ApprovalAction
  ruleId: string | null
}

/**
 * Decide auto_approve vs. force_manual for `ctx`.
 *
 * Filters to active rules for `ctx.movementType`, evaluates them in ascending
 * `priority` order (lower first), and returns the first one that matches. A
 * matching rule whose predicate forces manual review always yields
 * `force_manual`, regardless of the rule's own `action`. No matching rule is a
 * fail-safe `force_manual` with `ruleId: null` — an unmodelled movement always
 * needs a human.
 */
export function decideApproval(
  rules: readonly ApprovalRuleLike[],
  ctx: ApprovalContext,
): ApprovalDecision {
  const candidates = rules
    .filter((rule) => rule.isActive && rule.movementType === ctx.movementType)
    .toSorted((a, b) => a.priority - b.priority)

  for (const rule of candidates) {
    const { matched, forcesManual } = evaluateRule(rule.predicate, ctx)
    if (!matched) continue
    return { action: forcesManual ? 'force_manual' : rule.action, ruleId: rule.id }
  }

  return { action: 'force_manual', ruleId: null }
}
