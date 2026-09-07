/**
 * Full-database export (System Admin only). Reads every registered table page
 * by page and returns the raw rows, ready to be turned into one workbook — one
 * sheet per table — by the presentation layer.
 *
 * RLS is still the real gate: this only ever *reads*, and a caller without the
 * `system_admin` grant simply gets empty / partial results per table. A table
 * that errors (missing grant, relation absent) is recorded in `skipped` and the
 * export continues — one bad table never sinks the whole download.
 *
 * `claude.md` B.5: raw transport errors are caught here and mapped to
 * `AppError`; nothing throws across the boundary.
 */
import { appError } from '@/core/errors'
import { ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'

/** Every business table, in a sensible reading order (master → docs → ledgers). */
export const EXPORT_TABLES: readonly string[] = Object.values(Tables)

const PAGE_SIZE = 1000
/** Safety ceiling per table so a runaway table can't freeze the browser tab. */
const MAX_ROWS_PER_TABLE = 100_000

export interface TableDump {
  table: string
  rows: Record<string, unknown>[]
  /** True when the row cap was hit and the dump is partial. */
  truncated: boolean
}

export interface SkippedTable {
  table: string
  reason: string
}

export interface FullExport {
  dumps: TableDump[]
  skipped: SkippedTable[]
  /** ISO timestamp the export was taken. */
  takenAt: string
}

export interface ExportProgress {
  /** 1-based position of the table currently being read. */
  index: number
  total: number
  table: string
  /** Rows collected for this table so far. */
  rows: number
}

export interface ExportAllOptions {
  onProgress?: (progress: ExportProgress) => void
  signal?: AbortSignal
}

async function fetchTable(
  table: string,
  onRows: (count: number) => void,
  signal?: AbortSignal,
): Promise<TableDump> {
  const rows: Record<string, unknown>[] = []
  let truncated = false

  for (let page = 0; ; page++) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')

    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: table,
      queries: [Query.orderAsc('$id'), Query.limit(PAGE_SIZE), Query.offset(page * PAGE_SIZE)],
    })

    for (const raw of res.rows) {
      const clean: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(raw)) {
        if (key.startsWith('$')) continue // drop the shim's `$id` / `$permissions` etc.
        clean[key] = value
      }
      rows.push(clean)
    }
    onRows(rows.length)

    if (res.rows.length < PAGE_SIZE) break
    if (rows.length >= MAX_ROWS_PER_TABLE) {
      truncated = true
      break
    }
  }

  return { table, rows, truncated }
}

/**
 * Read every table. Resolves with whatever was collected; only a cancel
 * (`AbortError`) rejects — per-table failures land in `skipped`.
 */
export async function exportAllData(options: ExportAllOptions = {}): Promise<Result<FullExport>> {
  const { onProgress, signal } = options
  const dumps: TableDump[] = []
  const skipped: SkippedTable[] = []
  const total = EXPORT_TABLES.length

  for (let i = 0; i < total; i++) {
    const table = EXPORT_TABLES[i]!
    if (signal?.aborted) {
      return {
        ok: false,
        error: appError('unknown', 'تم إلغاء التصدير.', { detail: 'aborted' }),
      }
    }
    onProgress?.({ index: i + 1, total, table, rows: 0 })
    try {
      const dump = await fetchTable(
        table,
        (count) => onProgress?.({ index: i + 1, total, table, rows: count }),
        signal,
      )
      dumps.push(dump)
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return {
          ok: false,
          error: appError('unknown', 'تم إلغاء التصدير.', { detail: 'aborted' }),
        }
      }
      skipped.push({ table, reason: mapAppwriteError(e).message })
    }
  }

  return ok({ dumps, skipped, takenAt: new Date().toISOString() })
}
