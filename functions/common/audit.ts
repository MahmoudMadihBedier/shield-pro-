/**
 * Append one row to `audit_log`. Every state-changing Function calls this — no
 * exceptions (Implementation Plan §4.7). `before` / `after` are JSON-stringified
 * so the column stays a plain string.
 */
import { ID, type TablesDB } from 'node-appwrite'

import { DATABASE_ID } from './appwrite'

export interface AuditEntry {
  /** Caller `$id`, or `'system'` when there is no session. Max 36 chars. */
  actorId: string | null
  /** Verb: `submit`, `cancel`, … Max 48 chars. */
  action: string
  /** Table id the entity lives in. Max 32 chars. */
  entityType: string
  /** The document's `reference_id`. Max 32 chars. */
  entityRef: string
  before?: unknown
  after?: unknown
}

export async function appendAudit(tablesDB: TablesDB, entry: AuditEntry): Promise<void> {
  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: 'audit_log',
    rowId: ID.unique(),
    data: {
      actor_id: (entry.actorId ?? 'system').slice(0, 36),
      action: entry.action.slice(0, 48),
      entity_type: entry.entityType.slice(0, 32),
      entity_ref: entry.entityRef.slice(0, 32),
      before: JSON.stringify(entry.before ?? null),
      after: JSON.stringify(entry.after ?? null),
      created_at: new Date().toISOString(),
    },
  })
}
