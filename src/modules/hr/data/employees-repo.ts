/**
 * Read-only employee roster for payroll — `users` rows with `base_salary`.
 *
 * NOTE (blocked/assumed — see final report): `@/modules/admin`'s exported
 * `User` / `userRowSchema` do not yet include the `base_salary` column, even
 * though `scripts/appwrite/schema.ts` already has it (`users.base_salary`,
 * float, default 0) and `admin` is off-limits to edit from this module. This
 * repo extends the imported `userRowSchema` (Zod `.extend`, never mutates the
 * original) with `base_salary` and queries `Tables.users` (shared
 * infrastructure, not an admin file) directly, so payroll can read the salary
 * column without touching `@/modules/admin`.
 */
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { Query, tablesDB } from '@/infrastructure/appwrite/services'
import { userRowSchema } from '@/modules/admin'

export const employeeRowSchema = userRowSchema.extend({
  base_salary: z.number().nullish().transform((v) => v ?? 0),
})
export type Employee = z.infer<typeof employeeRowSchema>

const SHAPE_ERROR =
  'تعذّر قراءة سجل الموظف — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

export interface EmployeeListParams {
  branchId?: string
  /** Defaults to `true` — only staff currently employed. */
  activeOnly?: boolean
  page?: number
  pageSize?: number
}

export interface EmployeeListPage {
  rows: Employee[]
  total: number
}

const DEFAULT_PAGE_SIZE = 200

export async function listEmployees(
  params: EmployeeListParams = {},
): Promise<Result<EmployeeListPage>> {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE
  const page = params.page ?? 0
  const queries: string[] = [
    Query.limit(pageSize),
    Query.offset(page * pageSize),
    Query.orderAsc('full_name'),
  ]
  if (params.activeOnly ?? true) queries.push(Query.equal('is_active', true))
  if (params.branchId) queries.push(Query.equal('branch_id', params.branchId))

  try {
    const res = await tablesDB.listRows({ databaseId: DATABASE_ID, tableId: Tables.users, queries })
    const rows: Employee[] = []
    for (const raw of res.rows) {
      const parsed = employeeRowSchema.safeParse(raw)
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
