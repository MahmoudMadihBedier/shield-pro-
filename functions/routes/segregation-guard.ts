/**
 * Read-only pre-check: does `<table>/<rowId>` currently violate any
 * segregation-of-duties rule? The client calls this before showing a Submit
 * button so the user sees the problem early — the authoritative check still runs
 * inside `submit-document` / `cancel-document`.
 *
 * No writes, so no transaction wrapper and no audit row.
 */
import type { TablesDB } from 'node-appwrite'

import { DATABASE_ID } from '../common/appwrite'
import { FnError } from '../common/handler'
import { checkSegregation } from '@/core/segregation'
import { isSubmittableDocTable } from '@/core/document'

export interface SegregationGuardInput {
  table: string
  rowId: string
}

export interface SegregationGuardOutput {
  violated: string[]
  clean: boolean
}

function isNotFound(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: number }).code === 404
}

export async function segregationGuard(
  tablesDB: TablesDB,
  input: SegregationGuardInput,
  caller: string | null,
): Promise<SegregationGuardOutput> {
  const table = String(input?.table ?? '')
  const rowId = String(input?.rowId ?? '')
  if (!caller) throw new FnError('unauthorized', 'a signed-in caller is required')
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

  const { violated } = checkSegregation(row)
  return { violated, clean: violated.length === 0 }
}
