/**
 * The single server-side authority for reference-ID sequences. A missing number
 * in a series is an auditor's red flag, so allocation is:
 *   - gap-free   — one atomic `incrementRowColumn` per call, no read-modify-write race
 *   - server-only — the client never invents a sequence
 *
 * Counter rows in `naming_series_counters` are keyed `<PREFIX>-<YYYY>` and hold
 * `next_value` = the next sequence to hand out. The provisioner seeds the
 * current year; a fresh year is created lazily here.
 */
import type { TablesDB } from 'node-appwrite'

import { DATABASE_ID } from '../common/appwrite'
import { requireStaffCaller } from '../common/caller'
import { FnError } from '../common/handler'
import {
  REFERENCE_PREFIXES,
  formatReferenceId,
  type ReferenceEntity,
} from '@/core/reference-id'

const COUNTERS = 'naming_series_counters'

export interface AllocateInput {
  /** A key of `REFERENCE_PREFIXES`, e.g. `"SalesInvoice"`. */
  entity: string
}

export interface AllocateOutput {
  referenceId: string
  prefix: string
  year: number
  sequence: number
}

function isReferenceEntity(value: string): value is ReferenceEntity {
  return Object.prototype.hasOwnProperty.call(REFERENCE_PREFIXES, value)
}

function hasCode(e: unknown, code: number): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === code
}
const isNotFound = (e: unknown): boolean => hasCode(e, 404)
const isConflict = (e: unknown): boolean => hasCode(e, 409)

async function bumpCounter(tablesDB: TablesDB, rowId: string): Promise<number> {
  const updated = (await tablesDB.incrementRowColumn({
    databaseId: DATABASE_ID,
    tableId: COUNTERS,
    rowId,
    column: 'next_value',
    value: 1,
  })) as unknown as { next_value: number }
  // `next_value` now points at the *following* sequence; we consumed the prior.
  return Number(updated.next_value) - 1
}

export async function allocateReferenceId(
  tablesDB: TablesDB,
  input: AllocateInput,
  caller: string | null,
  now: Date = new Date(),
): Promise<AllocateOutput> {
  if (!caller) throw new FnError('unauthorized', 'a signed-in caller is required')
  await requireStaffCaller(tablesDB, caller)

  const entity = String(input?.entity ?? '')
  if (!isReferenceEntity(entity)) {
    throw new FnError('validation', `unknown reference entity "${entity}"`)
  }

  const prefix = REFERENCE_PREFIXES[entity]
  const year = now.getUTCFullYear()
  const rowId = `${prefix}-${year}`

  let sequence: number
  try {
    sequence = await bumpCounter(tablesDB, rowId)
  } catch (e) {
    if (!isNotFound(e)) throw e
    // First document of a new year — create the counter starting past sequence 1.
    try {
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: COUNTERS,
        rowId,
        data: { prefix, year, next_value: 2 },
      })
      sequence = 1
    } catch (createErr) {
      // A concurrent first-of-year call created the counter first; the atomic
      // increment is now valid again.
      if (!isConflict(createErr)) throw createErr
      sequence = await bumpCounter(tablesDB, rowId)
    }
  }

  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new FnError('server', `counter ${rowId} produced a bad sequence (${sequence})`)
  }

  return { referenceId: formatReferenceId(entity, sequence, year), prefix, year, sequence }
}
