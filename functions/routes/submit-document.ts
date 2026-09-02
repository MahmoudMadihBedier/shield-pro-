/**
 * Draft → Submitted. The only path that confirms a business document.
 *
 * Story 1.2 scope: state transition + posting timestamp + audit trail.
 * Deferred: SoD guard (Story 2.1), tiered approval engine (2.2), ledger posting
 * (1.3). Those hook in here as follow-ups, before the `updateRow` call.
 */
import { Permission, Role, type TablesDB } from 'node-appwrite'

import { DATABASE_ID } from '../common/appwrite'
import { FnError } from '../common/handler'
import { appendAudit } from '../common/audit'
import { DocStatus, canTransition } from '@/core/doc-status'
import { documentEnvelopeSchema, isSubmittableDocTable } from '@/core/document'

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
  // TODO(story 2.1): assert the caller's role + branch may submit this document.

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
    after: { doc_status: DocStatus.Submitted, posting_datetime: postingDatetime },
  })

  return {
    table,
    rowId,
    referenceId: envelope.data.reference_id,
    docStatus: DocStatus.Submitted,
    postingDatetime,
  }
}
