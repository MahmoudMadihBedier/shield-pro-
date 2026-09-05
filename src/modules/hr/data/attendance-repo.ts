/**
 * Data layer for `attendance_records` — an append-only per-employee/per-day
 * log, NOT a submittable document (`scripts/appwrite/schema.ts`: no
 * `doc_status` / `reference_id`). Client permissions only allow `create`;
 * Appwrite row security auto-grants the creator `update` on their own row, so
 * a same-day correction is implemented as an **upsert-by-day**: look up the
 * `(user_id, date)` row first, `updateRow` if it exists, else `createRow`.
 *
 * Contract (`claude.md` B.5): catch raw Appwrite errors → typed `AppError`;
 * Zod-parse every row; return `Result<T, AppError>` — never throw across the
 * boundary.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { ID, Query, tablesDB } from '@/infrastructure/appwrite/services'

import {
  attendanceRecordRowSchema,
  type AttendanceRecord,
  type AttendanceStatus,
} from '../domain/schemas'

const SHAPE_ERROR =
  'تعذّر قراءة سجل الحضور — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

function parseRow(raw: unknown): Result<AttendanceRecord> {
  const parsed = attendanceRecordRowSchema.safeParse(raw)
  if (!parsed.success) {
    return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
  }
  return ok(parsed.data)
}

export interface UpsertAttendanceInput {
  userId: string
  date: string
  checkIn?: string | null
  checkOut?: string | null
  status: AttendanceStatus
  notes?: string | null
  branchId?: string | null
  createdBy: string
}

/**
 * Insert (or, if a row for that employee+day already exists, update) one
 * attendance entry. Never creates a second row for the same `(user_id, date)`
 * pair — the unique index would reject it anyway, but checking first gives a
 * clean update instead of a conflict error.
 */
export async function upsertAttendance(
  input: UpsertAttendanceInput,
): Promise<Result<AttendanceRecord>> {
  const data = {
    user_id: input.userId,
    date: input.date,
    check_in: input.checkIn ?? null,
    check_out: input.checkOut ?? null,
    status: input.status,
    notes: input.notes ?? null,
    branch_id: input.branchId ?? null,
    created_by: input.createdBy,
    created_at: new Date().toISOString(),
  }

  try {
    const existing = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.attendanceRecords,
      queries: [
        Query.equal('user_id', input.userId),
        Query.equal('date', input.date),
        Query.limit(1),
      ],
    })

    const existingRow = existing.rows[0]
    if (existingRow) {
      const updated = await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: Tables.attendanceRecords,
        rowId: (existingRow as { $id: string }).$id,
        // `created_by` / `created_at` stay as originally recorded.
        data: {
          check_in: data.check_in,
          check_out: data.check_out,
          status: data.status,
          notes: data.notes,
          branch_id: data.branch_id,
        },
      })
      return parseRow(updated)
    }

    const created = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: Tables.attendanceRecords,
      rowId: ID.unique(),
      data,
    })
    return parseRow(created)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export interface AttendanceListParams {
  userId?: string
  branchId?: string
  /** Inclusive lower bound on `date` ("YYYY-MM-DD"). */
  from?: string
  /** Inclusive upper bound on `date` ("YYYY-MM-DD"). */
  to?: string
  page?: number
  pageSize?: number
}

export interface AttendanceListPage {
  rows: AttendanceRecord[]
  total: number
}

const DEFAULT_PAGE_SIZE = 31

export async function listAttendance(
  params: AttendanceListParams = {},
): Promise<Result<AttendanceListPage>> {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const page = params.page ?? 0
  const queries: string[] = [
    Query.limit(pageSize),
    Query.offset(page * pageSize),
    Query.orderDesc('date'),
  ]
  if (params.userId) queries.push(Query.equal('user_id', params.userId))
  if (params.branchId) queries.push(Query.equal('branch_id', params.branchId))
  if (params.from) queries.push(Query.greaterThanEqual('date', params.from))
  if (params.to) queries.push(Query.lessThanEqual('date', params.to))

  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.attendanceRecords,
      queries,
    })
    const rows: AttendanceRecord[] = []
    for (const raw of res.rows) {
      const parsed = parseRow(raw)
      if (!parsed.ok) return parsed
      rows.push(parsed.value)
    }
    return ok({ rows, total: res.total })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
