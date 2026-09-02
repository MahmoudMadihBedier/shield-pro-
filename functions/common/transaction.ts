/**
 * Run a unit of work inside an Appwrite TablesDB transaction so a route's
 * read-check-write sequence is atomic and isolated.
 *
 * Without this, `submit-document` / `cancel-document` have a TOCTOU race (two
 * concurrent calls both read `doc_status = Draft`, both write) and the
 * `audit_log` append is a separate, uncompensated write. Inside a transaction
 * the state change and its audit row commit together or not at all, and two
 * concurrent writers of the same row conflict at commit time.
 *
 * `bindTransaction` returns a thin forwarder that injects `transactionId` into
 * every row operation the pure `routes/*` logic performs — the logic keeps its
 * plain `TablesDB` signature and its unit tests are unchanged.
 *
 * NOTE: transaction isolation does NOT dedupe two concurrent first-time posts of
 * the same ledger voucher (they stage different rows and never see each other's
 * uncommitted writes). That still leans on the in-Function `listRows` check; a
 * DB-level unique index or a voucher-lock row would be the real backstop
 * (schema is frozen — revisit in a schema v2).
 */
import { TablesDB } from 'node-appwrite'

const TXN_OPS = [
  'getRow',
  'listRows',
  'createRow',
  'updateRow',
  'deleteRow',
  'incrementRowColumn',
  'decrementRowColumn',
] as const

/** Appwrite's smallest allowed transaction TTL, in seconds. */
const MIN_TTL = 60

function bindTransaction(tablesDB: TablesDB, transactionId: string): TablesDB {
  const forwarder: Record<string, unknown> = Object.create(tablesDB as object)
  for (const op of TXN_OPS) {
    const original = tablesDB[op] as unknown as (params: Record<string, unknown>) => unknown
    forwarder[op] = (params: Record<string, unknown>) =>
      original.call(tablesDB, { ...params, transactionId })
  }
  // The forwarder only overrides the object-form row ops the route logic uses;
  // everything else falls through to the real client via the prototype.
  return forwarder as unknown as TablesDB
}

export async function runInTransaction<T>(
  tablesDB: TablesDB,
  work: (db: TablesDB) => Promise<T>,
  ttl: number = MIN_TTL,
): Promise<T> {
  const txn = await tablesDB.createTransaction({ ttl: Math.max(ttl, MIN_TTL) })
  try {
    const result = await work(bindTransaction(tablesDB, txn.$id))
    await tablesDB.updateTransaction({ transactionId: txn.$id, commit: true })
    return result
  } catch (e) {
    try {
      await tablesDB.updateTransaction({ transactionId: txn.$id, rollback: true })
    } catch {
      /* best effort — the transaction TTL will expire it anyway */
    }
    throw e
  }
}
