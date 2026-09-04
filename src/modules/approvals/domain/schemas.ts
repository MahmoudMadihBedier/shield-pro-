/**
 * Zod schemas for the `approvals` module's three tables, kept in lockstep with
 * `scripts/appwrite/schema.ts` (`claude.md` B.2):
 *  - `approval_rules`   — master data, System-Admin-writable.
 *  - `approval_requests` — control plane, read-only to clients (Functions write it).
 *  - `approval_rule_log` — control plane, read-only to clients (Functions write it).
 *
 * `approval_rules.predicate` is a JSON-string column. `approvalRuleRowSchema`
 * keeps it as the raw wire string (exactly what Appwrite returns); the
 * structured shape a form binds to is `@/core/approval`'s `ApprovalPredicate`,
 * and `encodeApprovalPredicate` / `decodeApprovalPredicate` cross the boundary.
 *
 * `domain` is pure TypeScript — no react, no appwrite imports.
 */
import { z } from 'zod'

import {
  approvalPredicateSchema,
  decideApproval,
  type ApprovalContext,
  type ApprovalPredicate,
} from '@/core/approval'

// ---------------------------------------------------------------------------
// Shared column primitives
// ---------------------------------------------------------------------------

const systemFields = {
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
}

/** Row-side optional string: Appwrite returns `null` for an unset attribute. */
const rowOptStr = z.string().nullish()

// ---------------------------------------------------------------------------
// Enums (mirror scripts/appwrite/schema.ts)
// ---------------------------------------------------------------------------

export const APPROVAL_ACTIONS = ['auto_approve', 'force_manual'] as const
export const approvalActionSchema = z.enum(APPROVAL_ACTIONS)
export type ApprovalRuleAction = z.infer<typeof approvalActionSchema>

export const APPROVAL_REQUEST_STATES = ['pending', 'auto_approved', 'approved', 'rejected'] as const
export const approvalRequestStateSchema = z.enum(APPROVAL_REQUEST_STATES)
export type ApprovalRequestState = z.infer<typeof approvalRequestStateSchema>

/** Only these two states are a decision a human can still make. */
export const DECIDABLE_STATES: ReadonlySet<ApprovalRequestState> = new Set(['pending'])

// ---------------------------------------------------------------------------
// approval_rules
// ---------------------------------------------------------------------------

/** Exactly what Appwrite returns — `predicate` is the raw JSON string column. */
export const approvalRuleRowSchema = z.object({
  ...systemFields,
  movement_type: z.string(),
  predicate: z.string(),
  action: approvalActionSchema,
  priority: z
    .number()
    .nullish()
    .transform((v) => v ?? 100),
  is_active: z
    .boolean()
    .nullish()
    .transform((v) => v ?? true),
})
export type ApprovalRuleRow = z.infer<typeof approvalRuleRowSchema>

/** Form-facing input — `predicate` is the structured shape from `@/core/approval`. */
export const approvalRuleInputSchema = z.object({
  movement_type: z
    .string({ error: 'نوع الحركة مطلوب' })
    .trim()
    .min(1, 'نوع الحركة مطلوب')
    .max(32, 'نوع الحركة طويل جدًا'),
  predicate: approvalPredicateSchema,
  action: approvalActionSchema,
  priority: z
    .number({ error: 'الأولوية: أدخل رقمًا صحيحًا' })
    .int('الأولوية يجب أن تكون رقمًا صحيحًا')
    .min(0, 'الأولوية يجب ألا تكون سالبة')
    .max(100000, 'الأولوية كبيرة جدًا'),
  is_active: z.boolean(),
})
export type ApprovalRuleInput = z.infer<typeof approvalRuleInputSchema>

/** The wire shape `createRow`/`updateRow` actually receive — `predicate`
 *  collapsed to its JSON-string column. */
export const approvalRuleWireInputSchema = approvalRuleInputSchema.extend({
  predicate: z.string(),
})
export type ApprovalRuleWireInput = z.infer<typeof approvalRuleWireInputSchema>

export function encodeApprovalPredicate(predicate: ApprovalPredicate): string {
  return JSON.stringify(predicate)
}

/** Defensive: a malformed stored value decodes to "no conditions" rather than
 *  throwing — a rule that can never match beats a form that cannot render. */
export function decodeApprovalPredicate(raw: string): ApprovalPredicate {
  try {
    const parsed = approvalPredicateSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// approval_requests (control plane — read-only to clients)
// ---------------------------------------------------------------------------

export const approvalRequestRowSchema = z.object({
  ...systemFields,
  entity_type: z.string(),
  entity_ref: z.string(),
  branch_id: rowOptStr,
  requested_by: z.string(),
  state: approvalRequestStateSchema,
  decided_by: rowOptStr,
  decision_reason: rowOptStr,
  created_at: z.string(),
})
export type ApprovalRequestRow = z.infer<typeof approvalRequestRowSchema>

// ---------------------------------------------------------------------------
// approval_rule_log (control plane — read-only to clients)
// ---------------------------------------------------------------------------

export const approvalRuleLogRowSchema = z.object({
  ...systemFields,
  movement_type: z.string(),
  entity_ref: z.string(),
  actor_id: rowOptStr,
  rule_matched: rowOptStr,
  outcome: z.string(),
  created_at: z.string(),
})
export type ApprovalRuleLogRow = z.infer<typeof approvalRuleLogRowSchema>

// ---------------------------------------------------------------------------
// Re-exports — the engine itself lives in `@/core/approval`
// ---------------------------------------------------------------------------

export { approvalPredicateSchema, decideApproval }
export type { ApprovalContext, ApprovalPredicate }
