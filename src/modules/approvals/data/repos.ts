/**
 * Data layer for `approvals`.
 *
 *  - `approvalRulesRepo` — `approval_rules` is System-Admin-writable master
 *    data. Built on the generic master-repo factory
 *    (`@/modules/admin/data/master-repo`, reused as-is — it is exported
 *    generically and `admin` is the sanctioned read-only reference for shared
 *    patterns, `claude.md` module-structure notes) with a thin predicate
 *    encode/decode wrapper: the wire column is a JSON string, the form-facing
 *    input is the structured `ApprovalPredicate`.
 *  - `approvalRequestsRepo` / `approvalRuleLogRepo` — `approval_requests` and
 *    `approval_rule_log` are control-plane tables (Implementation Plan §4.5):
 *    Function-written only, read-only here.
 *
 * Every Appwrite call is caught and mapped to a typed `AppError`; every row is
 * Zod-parsed before it leaves this module (`claude.md` B.5).
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'
import { makeMasterRepo, type ListPage, type MasterRepo } from '@/modules/admin/data/master-repo'

import {
  approvalRequestRowSchema,
  approvalRuleLogRowSchema,
  approvalRuleRowSchema,
  approvalRuleWireInputSchema,
  encodeApprovalPredicate,
  type ApprovalRequestRow,
  type ApprovalRequestState,
  type ApprovalRuleInput,
  type ApprovalRuleLogRow,
  type ApprovalRuleRow,
  type ApprovalRuleWireInput,
} from '../domain/schemas'

// ---------------------------------------------------------------------------
// approval_rules — master data
// ---------------------------------------------------------------------------

const baseRulesRepo = makeMasterRepo<ApprovalRuleRow, ApprovalRuleWireInput>({
  tableId: Tables.approvalRules,
  rowSchema: approvalRuleRowSchema,
  inputSchema: approvalRuleWireInputSchema,
  searchField: 'movement_type',
})

/**
 * Same `MasterRepo` contract, with `predicate` crossing the boundary as the
 * structured `ApprovalPredicate` shape instead of a raw JSON string.
 */
export const approvalRulesRepo: MasterRepo<ApprovalRuleRow, ApprovalRuleInput> = {
  list: baseRulesRepo.list,
  get: baseRulesRepo.get,
  create: (input, overrides) =>
    baseRulesRepo.create({ ...input, predicate: encodeApprovalPredicate(input.predicate) }, overrides),
  update: (id, patch) => {
    const { predicate, ...rest } = patch
    const wirePatch: Partial<ApprovalRuleWireInput> = { ...rest }
    if (predicate !== undefined) wirePatch.predicate = encodeApprovalPredicate(predicate)
    return baseRulesRepo.update(id, wirePatch)
  },
}

// ---------------------------------------------------------------------------
// approval_requests — control plane, read-only
// ---------------------------------------------------------------------------

const SHAPE_ERROR = 'تعذّر قراءة أحد السجلات — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

export interface ApprovalRequestsListParams {
  page: number
  pageSize: number
  /** Filter to one state, e.g. `'pending'` for the exceptions dashboard. */
  state?: ApprovalRequestState
}

async function listApprovalRequests(
  params: ApprovalRequestsListParams,
): Promise<Result<ListPage<ApprovalRequestRow>>> {
  const { page, pageSize, state } = params
  const queries = [Query.limit(pageSize), Query.offset(page * pageSize), Query.orderDesc('created_at')]
  if (state) queries.push(Query.equal('state', state))

  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.approvalRequests,
      queries,
    })
    const rows: ApprovalRequestRow[] = []
    for (const raw of res.rows) {
      const parsed = approvalRequestRowSchema.safeParse(raw)
      if (!parsed.success) {
        return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
      }
      rows.push(parsed.data)
    }
    return ok({ rows, total: res.total })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

async function getApprovalRequest(id: string): Promise<Result<ApprovalRequestRow>> {
  try {
    const row = await tablesDB.getRow({ databaseId: DATABASE_ID, tableId: Tables.approvalRequests, rowId: id })
    const parsed = approvalRequestRowSchema.safeParse(row)
    if (!parsed.success) return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
    return ok(parsed.data)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export const approvalRequestsRepo = {
  list: listApprovalRequests,
  get: getApprovalRequest,
}

// ---------------------------------------------------------------------------
// approval_rule_log — control plane, read-only
// ---------------------------------------------------------------------------

export interface ApprovalRuleLogListParams {
  page: number
  pageSize: number
  entityRef?: string
}

async function listApprovalRuleLog(
  params: ApprovalRuleLogListParams,
): Promise<Result<ListPage<ApprovalRuleLogRow>>> {
  const { page, pageSize, entityRef } = params
  const queries = [Query.limit(pageSize), Query.offset(page * pageSize), Query.orderDesc('created_at')]
  if (entityRef) queries.push(Query.equal('entity_ref', entityRef))

  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.approvalRuleLog,
      queries,
    })
    const rows: ApprovalRuleLogRow[] = []
    for (const raw of res.rows) {
      const parsed = approvalRuleLogRowSchema.safeParse(raw)
      if (!parsed.success) {
        return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
      }
      rows.push(parsed.data)
    }
    return ok({ rows, total: res.total })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export const approvalRuleLogRepo = {
  list: listApprovalRuleLog,
}

export type { ListPage, ListSort } from '@/modules/admin/data/master-repo'
