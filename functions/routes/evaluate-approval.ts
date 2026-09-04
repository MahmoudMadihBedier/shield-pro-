/**
 * `/evaluate-approval` — decide `auto_approve` vs `force_manual` for a
 * movement, per the tiered rules configured in `approval_rules`
 * (Implementation Plan §4.5, Phase 2 Story 2.2).
 *
 * Every evaluation appends one row to `approval_rule_log`. The first
 * evaluation for a given `entityRef` also creates its `approval_requests` row
 * (`auto_approved` when the engine cleared it, `pending` when a human must
 * decide — see `/decide-approval`). A later call for the same `entityRef`
 * never creates a second request: it is idempotent and just replays the
 * existing row's outcome.
 */
import { ID, Query, type TablesDB } from 'node-appwrite'

import { DATABASE_ID } from '../common/appwrite'
import { requireStaffCaller } from '../common/caller'
import { FnError } from '../common/handler'
import {
  approvalPredicateSchema,
  decideApproval,
  type ApprovalAction,
  type ApprovalContext,
  type ApprovalPredicate,
  type ApprovalRuleLike,
} from '@/core/approval'

const RULES_TABLE = 'approval_rules'
const REQUESTS_TABLE = 'approval_requests'
const LOG_TABLE = 'approval_rule_log'

export interface EvaluateApprovalInput {
  movementType: string
  entityRef: string
  context: Omit<ApprovalContext, 'movementType' | 'entityRef' | 'actorId'>
}

export interface EvaluateApprovalOutput {
  action: ApprovalAction
  ruleId: string | null
  approvalRequestId: string
}

/** `approval_requests.state` never left "pending" without going through the
 *  engine first (only `evaluateApproval` creates the row) — so "auto_approved"
 *  is the only state that did not require a human, whatever it is now. */
function stateToAction(state: unknown): ApprovalAction {
  return state === 'auto_approved' ? 'auto_approve' : 'force_manual'
}

/** `predicate` is stored as a JSON string. A malformed value is treated as an
 *  empty predicate — a rule that can never match rather than a hard failure. */
function parsePredicate(raw: unknown): ApprovalPredicate {
  if (typeof raw !== 'string' || raw.trim() === '') return {}
  try {
    const json: unknown = JSON.parse(raw)
    const parsed = approvalPredicateSchema.safeParse(json)
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

function toRule(row: Record<string, unknown>): ApprovalRuleLike {
  return {
    id: String(row.$id ?? ''),
    movementType: String(row.movement_type ?? ''),
    predicate: parsePredicate(row.predicate),
    action: row.action === 'auto_approve' ? 'auto_approve' : 'force_manual',
    priority: Number(row.priority ?? 100),
    isActive: Boolean(row.is_active),
  }
}

export async function evaluateApproval(
  tablesDB: TablesDB,
  input: EvaluateApprovalInput,
  caller: string | null,
  now: Date = new Date(),
): Promise<EvaluateApprovalOutput> {
  const movementType = String(input?.movementType ?? '').trim()
  const entityRef = String(input?.entityRef ?? '').trim()
  const context = (input?.context ?? {}) as EvaluateApprovalInput['context']

  if (!caller) throw new FnError('unauthorized', 'a signed-in caller is required')
  await requireStaffCaller(tablesDB, caller)

  if (!movementType) throw new FnError('validation', 'movementType is required')
  if (!entityRef) throw new FnError('validation', 'entityRef is required')

  // Idempotency: an evaluation already exists for this entity — replay it
  // rather than creating a second `approval_requests` row.
  const existing = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: REQUESTS_TABLE,
    queries: [Query.equal('entity_ref', entityRef), Query.limit(1)],
  })
  const existingRow = existing.rows?.[0] as { $id: string; state: string } | undefined
  if (existingRow) {
    return {
      action: stateToAction(existingRow.state),
      ruleId: null,
      approvalRequestId: existingRow.$id,
    }
  }

  const ruleRows = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: RULES_TABLE,
    queries: [Query.equal('movement_type', movementType), Query.equal('is_active', true)],
  })
  const rules = (ruleRows.rows ?? []).map((row) => toRule(row as Record<string, unknown>))

  const ctx: ApprovalContext = { movementType, entityRef, actorId: caller, ...context }
  const decision = decideApproval(rules, ctx)
  const createdAt = now.toISOString()

  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: LOG_TABLE,
    rowId: ID.unique(),
    data: {
      movement_type: movementType,
      entity_ref: entityRef,
      actor_id: caller,
      rule_matched: decision.ruleId ?? '',
      outcome: decision.action,
      created_at: createdAt,
    },
  })

  const request = (await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: REQUESTS_TABLE,
    rowId: ID.unique(),
    data: {
      entity_type: movementType,
      entity_ref: entityRef,
      branch_id: null,
      requested_by: caller,
      state: decision.action === 'auto_approve' ? 'auto_approved' : 'pending',
      created_at: createdAt,
    },
  })) as unknown as { $id: string }

  return { action: decision.action, ruleId: decision.ruleId, approvalRequestId: request.$id }
}
