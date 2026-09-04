/**
 * Read-only repository for `fraud_flags`. The table ships with no client write
 * permission (`scripts/appwrite/schema.ts` — `control()`); the only writers are
 * the `/fraud-scan` and `/review-fraud-flag` Functions (`./fraud-actions.ts`).
 *
 * Shape mirrors `src/modules/inventory/data/bin-balances-repo.ts`.
 *
 * Contract (`claude.md` B.5): catch raw Appwrite errors → typed `AppError`;
 * Zod-parse every row; return `Result<T, AppError>` — never throw across the
 * boundary.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'

import {
  fraudFlagRowSchema,
  type FraudFlagKind,
  type FraudFlagRow,
  type FraudFlagStatus,
} from '../domain/schemas'

const SHAPE_ERROR = 'تعذّر قراءة أحد بلاغات الاحتيال — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

const DEFAULT_PAGE_SIZE = 25

export interface FraudFlagListParams {
  status?: FraudFlagStatus
  kind?: FraudFlagKind
  page?: number
  pageSize?: number
}

export interface FraudFlagListPage {
  rows: FraudFlagRow[]
  total: number
}

export async function listFraudFlags(
  params: FraudFlagListParams = {},
): Promise<Result<FraudFlagListPage>> {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const page = params.page ?? 0
  const queries: string[] = [
    Query.limit(pageSize),
    Query.offset(page * pageSize),
    Query.orderDesc('created_at'),
  ]
  if (params.status) queries.push(Query.equal('status', params.status))
  if (params.kind) queries.push(Query.equal('kind', params.kind))

  try {
    const res = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: Tables.fraudFlags,
      queries,
    })
    const rows: FraudFlagRow[] = []
    for (const raw of res.rows) {
      const parsed = fraudFlagRowSchema.safeParse(raw)
      if (!parsed.success) {
        return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
      }
      rows.push(parsed.data)
    }
    return ok({ rows, total: res.total })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export async function getFraudFlag(id: string): Promise<Result<FraudFlagRow>> {
  try {
    const res = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: Tables.fraudFlags,
      rowId: id,
    })
    const parsed = fraudFlagRowSchema.safeParse(res)
    if (!parsed.success) {
      return err(appError('server', SHAPE_ERROR, { detail: parsed.error.message }))
    }
    return ok(parsed.data)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
