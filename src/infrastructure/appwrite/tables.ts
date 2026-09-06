/**
 * `tablesDB` — a shim exposing the slice of the Appwrite `TablesDB` API the
 * modules use (`listRows` / `getRow` / `createRow` / `updateRow` / `deleteRow`
 * / `incrementRowColumn`), backed by Supabase PostgREST.
 *
 * Two impedance mismatches are absorbed here so nothing above `infrastructure`
 * changes:
 *  1. Row keys: Supabase rows have `id` / `created_at` / `updated_at`; the app
 *     reads `$id` / `$createdAt` / `$updatedAt`. Reads get BOTH (originals kept
 *     for the handful of tables with a real `created_at` data column). Writes
 *     strip `$*` and `updated_at`.
 *  2. Queries: the `Query.*` helpers emit Appwrite-shaped JSON strings; here we
 *     parse them and apply `.eq()` / `.order()` / `.range()` / `.ilike()` etc.
 *
 * Errors are re-thrown as `Error` with a numeric `.code` (404 / 409 / …) so the
 * `isNotFound(e)` / `isConflict(e)` guards in the modules keep working.
 */
import type { PostgrestError } from '@supabase/supabase-js'

import { supabase } from './client'

interface ParsedQuery {
  method: string
  attribute?: string
  values?: unknown[]
}

interface ListParams {
  databaseId?: string
  tableId: string
  queries?: string[]
}
interface RowParams {
  databaseId?: string
  tableId: string
  rowId: string
}
interface CreateParams extends RowParams {
  data: Record<string, unknown>
  permissions?: string[]
}
interface UpdateParams extends RowParams {
  data?: Record<string, unknown>
  permissions?: string[]
}
interface IncrementParams extends RowParams {
  column: string
  value?: number
  max?: number
  min?: number
}

interface Row {
  [k: string]: unknown
  $id: string
  $createdAt?: string
  $updatedAt?: string
  $sequence?: string
  $permissions?: string[]
}
interface RowList {
  total: number
  rows: Row[]
}

function coded(message: string, code: number): Error & { code: number } {
  return Object.assign(new Error(message), { code })
}

function throwFrom(error: PostgrestError | null, context: string): never {
  if (!error) throw coded(`${context}: unknown error`, 500)
  // PGRST116 = "Results contain 0 rows" from `.single()`
  if (error.code === 'PGRST116') throw coded(`${context}: not found`, 404)
  if (error.code === '23505') throw coded(`${context}: ${error.message}`, 409) // unique_violation
  if (error.code === '42501' || error.code === 'PGRST301')
    throw coded(`${context}: ${error.message}`, 403)
  if (error.code === '23503' || error.code === '23514' || error.code === '22P02')
    throw coded(`${context}: ${error.message}`, 400)
  throw coded(`${context}: ${error.message}`, 500)
}

function toRow(raw: Record<string, unknown> | null): Row | null {
  if (!raw) return null
  const row: Row = { ...raw, $id: String(raw.id ?? '') }
  if (raw.created_at !== undefined) row.$createdAt = String(raw.created_at)
  if (raw.updated_at !== undefined) row.$updatedAt = String(raw.updated_at)
  row.$permissions = []
  return row
}

function stripSystem(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('$')) continue
    if (k === 'updated_at') continue
    out[k] = v
  }
  return out
}

function parseQueries(queries: string[] = []): ParsedQuery[] {
  return queries.map((q) => {
    try {
      return JSON.parse(q) as ParsedQuery
    } catch {
      return { method: 'noop' }
    }
  })
}

/** Appwrite system-field names the app still uses in queries → Postgres columns. */
const SYSTEM_ATTR: Record<string, string> = {
  $id: 'id',
  $createdAt: 'created_at',
  $updatedAt: 'updated_at',
  $sequence: 'id',
}

function col(attribute: string | undefined): string | undefined {
  if (attribute === undefined) return undefined
  return SYSTEM_ATTR[attribute] ?? attribute
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyQueries(builder: any, parsed: ParsedQuery[]) {
  let limit: number | undefined
  let offset: number | undefined
  let b = builder
  for (const p of parsed) {
    const a = col(p.attribute)
    const v = p.values ?? []
    switch (p.method) {
      case 'equal':
        b = v.length > 1 ? b.in(a, v) : b.eq(a, v[0])
        break
      case 'notEqual':
        b = b.neq(a, v[0])
        break
      case 'lessThan':
        b = b.lt(a, v[0])
        break
      case 'lessThanEqual':
        b = b.lte(a, v[0])
        break
      case 'greaterThan':
        b = b.gt(a, v[0])
        break
      case 'greaterThanEqual':
        b = b.gte(a, v[0])
        break
      case 'between':
        b = b.gte(a, v[0]).lte(a, v[1])
        break
      case 'startsWith':
        b = b.ilike(a, `${String(v[0])}%`)
        break
      case 'endsWith':
        b = b.ilike(a, `%${String(v[0])}`)
        break
      case 'contains':
      case 'search':
        b = b.ilike(a, `%${String(v[0])}%`)
        break
      case 'isNull':
        b = b.is(a, null)
        break
      case 'isNotNull':
        b = b.not(a, 'is', null)
        break
      case 'orderAsc':
        b = b.order(a, { ascending: true })
        break
      case 'orderDesc':
        b = b.order(a, { ascending: false })
        break
      case 'limit':
        limit = Number(v[0])
        break
      case 'offset':
        offset = Number(v[0])
        break
      case 'cursorAfter':
        b = b.gt('id', v[0])
        break
      case 'cursorBefore':
        b = b.lt('id', v[0])
        break
      case 'or':
        b = b.or(
          (v as string[])
            .map((s) => {
              const inner = JSON.parse(s) as ParsedQuery
              const iv = inner.values ?? []
              return `${col(inner.attribute)}.eq.${String(iv[0])}`
            })
            .join(','),
        )
        break
      default:
        break
    }
  }
  if (offset !== undefined || limit !== undefined) {
    const from = offset ?? 0
    const to = limit !== undefined ? from + limit - 1 : from + 999
    b = b.range(from, to)
  } else {
    b = b.limit(1000)
  }
  return b
}

export const tablesDB = {
  async listRows(params: ListParams): Promise<RowList> {
    const parsed = parseQueries(params.queries)
    const selectQ = parsed.find((p) => p.method === 'select')
    const cols = selectQ
      ? (selectQ.values as string[])
          .filter((c) => c !== '*')
          .map((c) => col(c) ?? c)
          .join(',') || '*'
      : '*'
    const base = supabase.from(params.tableId).select(cols, { count: 'exact' })
    const { data, error, count } = await applyQueries(base, parsed)
    if (error) throwFrom(error, `list ${params.tableId}`)
    return {
      total: count ?? (data as unknown[] | null)?.length ?? 0,
      rows: ((data as Record<string, unknown>[] | null) ?? []).map((r) => toRow(r) as Row),
    }
  },

  async getRow<T = Row>(params: RowParams): Promise<T> {
    const { data, error } = await supabase
      .from(params.tableId)
      .select('*')
      .eq('id', params.rowId)
      .maybeSingle()
    if (error) throwFrom(error, `get ${params.tableId}/${params.rowId}`)
    if (!data) throw coded(`get ${params.tableId}/${params.rowId}: not found`, 404)
    return toRow(data as Record<string, unknown>) as unknown as T
  },

  async createRow<T = Row>(params: CreateParams): Promise<T> {
    const payload = stripSystem(params.data)
    if (params.rowId && params.rowId !== 'unique()' && params.rowId !== 'ID.unique()') {
      payload.id = params.rowId
    }
    const { data, error } = await supabase.from(params.tableId).insert(payload).select('*').single()
    if (error) throwFrom(error, `create ${params.tableId}`)
    return toRow(data as Record<string, unknown>) as unknown as T
  },

  async updateRow<T = Row>(params: UpdateParams): Promise<T> {
    const { data, error } = await supabase
      .from(params.tableId)
      .update(stripSystem(params.data ?? {}))
      .eq('id', params.rowId)
      .select('*')
      .single()
    if (error) throwFrom(error, `update ${params.tableId}/${params.rowId}`)
    return toRow(data as Record<string, unknown>) as unknown as T
  },

  async deleteRow(params: RowParams): Promise<Record<string, never>> {
    const { error } = await supabase.from(params.tableId).delete().eq('id', params.rowId)
    if (error) throwFrom(error, `delete ${params.tableId}/${params.rowId}`)
    return {}
  },

  /** Non-atomic read-modify-write. The atomic path is `allocate_reference_id`
   *  / `post_*` RPC — this client shim only exists for completeness. */
  async incrementRowColumn<T = Row>(params: IncrementParams): Promise<T> {
    const current = await this.getRow<Record<string, unknown>>(params)
    const next = Number(current[params.column] ?? 0) + (params.value ?? 1)
    return this.updateRow<T>({
      tableId: params.tableId,
      rowId: params.rowId,
      data: { [params.column]: next },
    })
  },
}

export type { Row, RowList }
