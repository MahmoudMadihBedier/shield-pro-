/**
 * Generic master-data repository factory. Every `admin` entity is a plain CRUD
 * table with the same shape of access, so one factory + thin per-entity wrappers
 * keeps the data layer DRY (`claude.md` — no 8 near-identical files).
 *
 * Contract (`claude.md` B.5):
 *  - catch every raw Appwrite / transport error → typed `AppError`
 *  - Zod-parse every row before it leaves this layer
 *  - return `Result<T, AppError>` — never throw across the boundary
 *
 * Server-side pagination only: `Query.limit` / `Query.offset`, `Query.orderAsc`
 * / `Query.orderDesc`, and `Query.startsWith` on the configured search column
 * (the caller debounces the search term).
 */
import type { ZodType } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { ID, Query, tablesDB } from '@/infrastructure/appwrite/services'

export interface ListSort {
  field: string
  dir: 'asc' | 'desc'
}

/** Exact-match column filter, e.g. `{ field: 'branch_id', value: 'br-1' }`. */
export interface ListFilter {
  field: string
  value: string
}

export interface ListParams {
  search?: string
  page: number
  pageSize: number
  sort?: ListSort | null
  /** ANDed `Query.equal` filters (branch scoping, parent id, …). */
  filters?: ListFilter[]
}

export interface ListPage<T> {
  rows: T[]
  total: number
}

export interface MasterRepo<TRow, TInput> {
  list(params: ListParams): Promise<Result<ListPage<TRow>>>
  get(id: string): Promise<Result<TRow>>
  create(input: TInput, overrides?: Record<string, unknown>): Promise<Result<TRow>>
  update(id: string, patch: Partial<TInput>): Promise<Result<TRow>>
}

export interface MasterRepoConfig<TRow, TInput> {
  tableId: string
  rowSchema: ZodType<TRow>
  inputSchema: ZodType<TInput>
  /** Column `startsWith`-matched when `list({ search })` is given. */
  searchField: string
  /** Values merged into every `create` payload (e.g. workflow defaults). */
  createDefaults?: Record<string, unknown>
}

const SHAPE_ERROR =
  'تعذّر قراءة أحد السجلات — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

function parseRows<TRow>(
  raw: unknown[],
  rowSchema: ZodType<TRow>,
  tableId: string,
): Result<TRow[]> {
  const rows: TRow[] = []
  for (const item of raw) {
    const parsed = rowSchema.safeParse(item)
    if (!parsed.success) {
      return err(appError('server', SHAPE_ERROR, { detail: `${tableId}: ${parsed.error.message}` }))
    }
    rows.push(parsed.data)
  }
  return ok(rows)
}

export function makeMasterRepo<TRow, TInput>(
  config: MasterRepoConfig<TRow, TInput>,
): MasterRepo<TRow, TInput> {
  const { tableId, rowSchema, inputSchema, searchField, createDefaults } = config

  async function list(params: ListParams): Promise<Result<ListPage<TRow>>> {
    const { search, page, pageSize, sort, filters } = params
    const queries = [Query.limit(pageSize), Query.offset(page * pageSize)]
    if (sort) {
      queries.push(sort.dir === 'asc' ? Query.orderAsc(sort.field) : Query.orderDesc(sort.field))
    }
    for (const filter of filters ?? []) {
      queries.push(Query.equal(filter.field, filter.value))
    }
    const term = search?.trim()
    if (term) queries.push(Query.startsWith(searchField, term))

    try {
      const res = await tablesDB.listRows({ databaseId: DATABASE_ID, tableId, queries })
      const parsed = parseRows(res.rows as unknown[], rowSchema, tableId)
      if (!parsed.ok) return parsed
      return ok({ rows: parsed.value, total: res.total })
    } catch (e) {
      return err(mapAppwriteError(e))
    }
  }

  async function get(id: string): Promise<Result<TRow>> {
    try {
      const row = await tablesDB.getRow({ databaseId: DATABASE_ID, tableId, rowId: id })
      const parsed = rowSchema.safeParse(row)
      if (!parsed.success) {
        return err(appError('server', SHAPE_ERROR, { detail: `${tableId}/${id}: ${parsed.error.message}` }))
      }
      return ok(parsed.data)
    } catch (e) {
      return err(mapAppwriteError(e))
    }
  }

  async function create(
    input: TInput,
    overrides: Record<string, unknown> = {},
  ): Promise<Result<TRow>> {
    const parsedInput = inputSchema.safeParse(input)
    if (!parsedInput.success) {
      return err(appError('validation', 'البيانات المُدخلة غير صالحة.', { detail: parsedInput.error.message }))
    }
    const data = { ...(parsedInput.data as Record<string, unknown>), ...createDefaults, ...overrides }
    try {
      const row = await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId: ID.unique(),
        data,
      })
      const parsed = rowSchema.safeParse(row)
      if (!parsed.success) {
        return err(appError('server', SHAPE_ERROR, { detail: `${tableId}: ${parsed.error.message}` }))
      }
      return ok(parsed.data)
    } catch (e) {
      return err(mapAppwriteError(e))
    }
  }

  async function update(id: string, patch: Partial<TInput>): Promise<Result<TRow>> {
    const partialSchema = (inputSchema as unknown as { partial: () => ZodType<Partial<TInput>> }).partial()
    const parsedPatch = partialSchema.safeParse(patch)
    if (!parsedPatch.success) {
      return err(appError('validation', 'البيانات المُدخلة غير صالحة.', { detail: parsedPatch.error.message }))
    }
    try {
      const row = await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId: id,
        data: parsedPatch.data as Record<string, unknown>,
      })
      const parsed = rowSchema.safeParse(row)
      if (!parsed.success) {
        return err(appError('server', SHAPE_ERROR, { detail: `${tableId}/${id}: ${parsed.error.message}` }))
      }
      return ok(parsed.data)
    } catch (e) {
      return err(mapAppwriteError(e))
    }
  }

  return { list, get, create, update }
}

/**
 * `remove` is only exposed for tables with no downstream ledger / document
 * references (`suppliers`, `raw_materials`, `product_bom`). Everything else is
 * corrected with an `is_active` flag, never a hard delete (`IMPLEMENTATION_PLAN`
 * §1 rule 5, "no deletion").
 */
export function makeRemove(tableId: string) {
  return async function remove(id: string): Promise<Result<void>> {
    try {
      await tablesDB.deleteRow({ databaseId: DATABASE_ID, tableId, rowId: id })
      return ok(undefined)
    } catch (e) {
      return err(mapAppwriteError(e))
    }
  }
}
