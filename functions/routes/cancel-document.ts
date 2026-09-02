/**
 * Submitted → Cancelled. Corrections are never edits or deletes: cancel with a
 * reason, then create a fresh Draft carrying `amended_from` (Implementation Plan
 * §4.2). A `reason` is mandatory.
 *
 * Story 1.2 scope: state transition + reason on `remarks` + audit trail.
 * Deferred: reversing ledger entries (Story 1.3).
 */
import type { TablesDB } from 'node-appwrite'

import { DATABASE_ID } from '../common/appwrite'
import { FnError } from '../common/handler'
import { appendAudit } from '../common/audit'
import { DocStatus, canTransition } from '@/core/doc-status'
import { documentEnvelopeSchema, isSubmittableDocTable } from '@/core/document'

export interface CancelInput {
  table: string
  rowId: string
  reason: string
}

export interface CancelOutput {
  table: string
  rowId: string
  referenceId: string
  docStatus: typeof DocStatus.Cancelled
}

function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404
}

const REMARKS_MAX = 2000

export async function cancelDocument(
  tablesDB: TablesDB,
  input: CancelInput,
  caller: string | null,
): Promise<CancelOutput> {
  const table = String(input?.table ?? '')
  const rowId = String(input?.rowId ?? '')
  const reason = String(input?.reason ?? '').trim()
  if (!caller) throw new FnError('unauthorized', 'a signed-in caller is required to cancel')
  if (!isSubmittableDocTable(table)) {
    throw new FnError('validation', `"${table}" is not a submittable document table`)
  }
  if (!rowId) throw new FnError('validation', 'rowId is required')
  if (!reason) throw new FnError('validation', 'a cancellation reason is required')
  // TODO(story 2.1): assert the caller's role + branch may cancel this document.

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
  if (!canTransition(from, DocStatus.Cancelled)) {
    throw new FnError(
      'conflict',
      from === DocStatus.Draft
        ? 'a draft cannot be cancelled — delete it instead'
        : 'document is already cancelled',
    )
  }

  // Stamp first so the reason always survives the 2000-char cap even when the
  // document already carries long remarks.
  const stamp = `Cancelled by ${caller ?? 'system'}: ${reason}`
  const remarks = [stamp, envelope.data.remarks].filter(Boolean).join('\n').slice(0, REMARKS_MAX)

  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: table,
    rowId,
    data: { doc_status: DocStatus.Cancelled, remarks },
  })

  await appendAudit(tablesDB, {
    actorId: caller,
    action: 'cancel',
    entityType: table,
    entityRef: envelope.data.reference_id,
    before: { doc_status: DocStatus.Submitted },
    after: { doc_status: DocStatus.Cancelled, reason },
  })

  return { table, rowId, referenceId: envelope.data.reference_id, docStatus: DocStatus.Cancelled }
}
