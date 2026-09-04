/**
 * Draft → Submitted. The only path that confirms a business document.
 *
 * Story 1.2 scope: state transition + posting timestamp + audit trail.
 * Story 2.1 adds the RBAC + branch-scope + segregation-of-duties gate below.
 * Deferred: tiered approval engine (2.2), ledger posting (1.3). Those hook in
 * here as follow-ups, before the `updateRow` call.
 */
import { Permission, Role, type TablesDB } from 'node-appwrite'

import { DATABASE_ID } from '../common/appwrite'
import { FnError } from '../common/handler'
import { appendAudit } from '../common/audit'
import { loadCallerContext } from '../common/caller'
import { DocStatus, canTransition } from '@/core/doc-status'
import { documentEnvelopeSchema, isSubmittableDocTable } from '@/core/document'
import { canActOnBranch, canSubmitTable } from '@/core/access'
import { assertNoSelfApproval } from '@/core/segregation'

/** A submitted document is immutable to every client — only Functions write it. */
const READ_ONLY_PERMS = [Permission.read(Role.users())]

export interface SubmitInput {
  table: string
  rowId: string
}

export interface SubmitOutput {
  table: string
  rowId: string
  referenceId: string
  docStatus: typeof DocStatus.Submitted
  postingDatetime: string
}

function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404
}

export async function submitDocument(
  tablesDB: TablesDB,
  input: SubmitInput,
  caller: string | null,
  now: Date = new Date(),
): Promise<SubmitOutput> {
  const table = String(input?.table ?? '')
  const rowId = String(input?.rowId ?? '')
  if (!caller) throw new FnError('unauthorized', 'a signed-in caller is required to submit')
  if (!isSubmittableDocTable(table)) {
    throw new FnError('validation', `"${table}" is not a submittable document table`)
  }
  if (!rowId) throw new FnError('validation', 'rowId is required')

  let row: Record<string, unknown>
  try {
    row = (await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: table,
      rowId,
    })) as unknown as Record<string, unknown>
  } catch (e) {
    if (isNotFound(e)) throw new FnError('not_found', `${table}/${rowId} does not exist`)
    throw e
  }

  const envelope = documentEnvelopeSchema.safeParse(row)
  if (!envelope.success) {
    throw new FnError('server', `${table}/${rowId} is missing a valid document envelope`)
  }

  // Story 2.1 — RBAC + branch scope + segregation of duties. Enforcement lives
  // here (and in collection permissions), never in the client (claude.md A.6).
  const callerCtx = await loadCallerContext(tablesDB, caller)
  if (!canSubmitTable(callerCtx.roles, table)) {
    throw new FnError('forbidden', 'your role may not submit this document type')
  }
  if (
    !canActOnBranch(
      { userId: callerCtx.userId, roles: callerCtx.roles, branchId: callerCtx.branchId },
      envelope.data.branch_id,
    )
  ) {
    throw new FnError('forbidden', 'this document belongs to another branch')
  }
  try {
    assertNoSelfApproval(row)
  } catch (e) {
    throw new FnError(
      'forbidden',
      e instanceof Error ? e.message : 'segregation of duties violated',
    )
  }

  const from = envelope.data.doc_status
  // `canTransition` is the domain rule; the branch below only picks a clearer
  // message for the two ways it can fail.
  if (!canTransition(from, DocStatus.Submitted)) {
    throw new FnError(
      'conflict',
      `document is ${from === DocStatus.Submitted ? 'already submitted' : 'cancelled'}`,
    )
  }

  const postingDatetime = now.toISOString()
  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: table,
    rowId,
    data: { doc_status: DocStatus.Submitted, posting_datetime: postingDatetime },
    // Strip the creator's row-level write perms — the draft is now confirmed.
    permissions: READ_ONLY_PERMS,
  })

  await appendAudit(tablesDB, {
    actorId: caller,
    action: 'submit',
    entityType: table,
    entityRef: envelope.data.reference_id,
    before: { doc_status: DocStatus.Draft },
    after: {
      doc_status: DocStatus.Submitted,
      posting_datetime: postingDatetime,
      actorRoles: callerCtx.roles,
    },
  })

  return {
    table,
    rowId,
    referenceId: envelope.data.reference_id,
    docStatus: DocStatus.Submitted,
    postingDatetime,
  }
}
