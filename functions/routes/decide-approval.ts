/**
 * `/decide-approval` — a human resolves a `pending` `approval_requests` row:
 * `approved` or `rejected` (Implementation Plan §4.5, Phase 2 Story 2.2).
 *
 * Only a `pending` request may be decided — `auto_approved` never reaches a
 * human, and `approved`/`rejected` are already final. Segregation of duties
 * applies here exactly like `submit-document`: the decider may not be the
 * request's own `requested_by`.
 *
 * Read-check-write + audit, same shape as `submit-document` /
 * `cancel-document` — the caller (`functions/server/src/main.ts`) wraps this
 * in `runInTransaction` so the state change and its audit row commit
 * together.
 */
import type { TablesDB } from 'node-appwrite'

import { DATABASE_ID } from '../common/appwrite'
import { requireStaffCaller } from '../common/caller'
import { FnError } from '../common/handler'
import { appendAudit } from '../common/audit'
import { assertNoSelfApproval } from '@/core/segregation'

const REQUESTS_TABLE = 'approval_requests'

export type ApprovalDecisionValue = 'approved' | 'rejected'

export interface DecideApprovalInput {
  approvalRequestId: string
  decision: ApprovalDecisionValue
  reason?: string
}

export interface DecideApprovalOutput {
  $id: string
  entityType: string
  entityRef: string
  branchId: string | null
  requestedBy: string
  state: ApprovalDecisionValue
  decidedBy: string
  decisionReason: string | null
}

function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404
}

export async function decideApprovalRequest(
  tablesDB: TablesDB,
  input: DecideApprovalInput,
  caller: string | null,
): Promise<DecideApprovalOutput> {
  const approvalRequestId = String(input?.approvalRequestId ?? '').trim()
  const decision = input?.decision
  const reason = input?.reason != null ? String(input.reason).trim() || null : null

  if (!caller) throw new FnError('unauthorized', 'a signed-in caller is required')
  await requireStaffCaller(tablesDB, caller)

  if (!approvalRequestId) throw new FnError('validation', 'approvalRequestId is required')
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new FnError('validation', 'decision must be "approved" or "rejected"')
  }

  let row: Record<string, unknown>
  try {
    row = (await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: REQUESTS_TABLE,
      rowId: approvalRequestId,
    })) as unknown as Record<string, unknown>
  } catch (e) {
    if (isNotFound(e)) {
      throw new FnError('not_found', `approval_requests/${approvalRequestId} does not exist`)
    }
    throw e
  }

  if (row.state !== 'pending') {
    throw new FnError('conflict', `approval request is already "${String(row.state)}"`)
  }

  // Segregation of duties — the person who requested the movement may not be
  // the one who decides it (`src/core/segregation.ts`, rule "requested-vs-approved").
  try {
    assertNoSelfApproval({ requested_by: row.requested_by, approved_by: caller })
  } catch (e) {
    throw new FnError(
      'forbidden',
      e instanceof Error ? e.message : 'segregation of duties violated',
    )
  }

  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: REQUESTS_TABLE,
    rowId: approvalRequestId,
    data: { state: decision, decided_by: caller, decision_reason: reason },
  })

  await appendAudit(tablesDB, {
    actorId: caller,
    action: 'decide_approval',
    entityType: String(row.entity_type ?? REQUESTS_TABLE),
    entityRef: String(row.entity_ref ?? approvalRequestId),
    before: { state: 'pending' },
    after: { state: decision, decidedBy: caller, reason },
  })

  return {
    $id: approvalRequestId,
    entityType: String(row.entity_type ?? ''),
    entityRef: String(row.entity_ref ?? ''),
    branchId: (row.branch_id as string | null | undefined) ?? null,
    requestedBy: String(row.requested_by ?? ''),
    state: decision,
    decidedBy: caller,
    decisionReason: reason,
  }
}
