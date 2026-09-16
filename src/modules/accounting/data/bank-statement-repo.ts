/**
 * Data layer for `bank_statement_lines` (migration 0041) — a plain paginated
 * read (RLS: System Admin / Chief Accountant only) plus a narrow reconcile
 * RPC. Not a `makeDocumentRepo` entity: no doc_status, no submit/cancel.
 *
 * Contract (`claude.md` B.5): catch raw errors → typed `AppError`; Zod-parse
 * every row; return `Result<T, AppError>` — never throw across the boundary.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { reconcileBankStatementLine as callReconcile } from '@/infrastructure/appwrite/functions'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'

import { bankStatementLineRowSchema, type BankStatementLine } from '../domain/bank-statement'

const SHAPE_ERROR = 'تعذّر قراءة سطر كشف الحساب — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

export interface BankStatementListParams {
  page?: number
  pageSize?: number
  /** Filter to only unreconciled / only reconciled lines. */
  reconciled?: boolean
}

export interface BankStatementListPage {
  rows: BankStatementLine[]
  total: number
}

function parseRows(raw: unknown[]): Result<BankStatementLine[]> {
  const rows: BankStatementLine[] = []
  for (const item of raw) {
    const parsed = bankStatementLineRowSchema.safeParse(item)
    if (!parsed.success) {
      return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
    }
    rows.push(parsed.data)
  }
  return ok(rows)
}

/** One page of bank statement lines, newest first. */
export async function listBankStatementLines(
  params: BankStatementListParams = {},
): Promise<Result<BankStatementListPage>> {
  const { page = 0, pageSize = 25, reconciled } = params
  const queries = [
    Query.limit(pageSize),
    Query.offset(page * pageSize),
    Query.orderDesc('statement_date'),
    // Tiebreaker: `statement_date` alone has no guaranteed order among same-day
    // rows, which would make offset pagination unstable (a row could appear
    // twice or be skipped across a page boundary as ties get reordered).
    Query.orderDesc('$createdAt'),
  ]
  if (reconciled !== undefined) queries.push(Query.equal('reconciled', reconciled ? 'true' : 'false'))

  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.bankStatementLines,
      queries,
    })
    const parsed = parseRows(res.rows as unknown[])
    if (!parsed.ok) return parsed
    return ok({ rows: parsed.value, total: res.total })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/** Toggle one line's reconciled flag (System Admin / Chief Accountant only, audited). */
export async function reconcileBankStatementLine(
  id: string,
  reconciled: boolean,
): Promise<Result<void>> {
  const res = await callReconcile(id, reconciled)
  if (!res.ok) return res
  return ok(undefined)
}
