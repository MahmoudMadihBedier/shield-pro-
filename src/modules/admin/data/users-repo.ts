/**
 * Users (profile) repository. Same CRUD surface as the other master data, plus
 * `setBranch` — the System-Admin-only action that binds a staff member to a
 * branch (`IMPLEMENTATION_PLAN.md` §4.6: branch binding is set exclusively by
 * the System Admin).
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { tablesDB } from '@/infrastructure/appwrite/services'

import { userInputSchema, userRowSchema, type User, type UserInput } from '../domain/schemas'
import { makeMasterRepo, type MasterRepo } from './master-repo'

const base: MasterRepo<User, UserInput> = makeMasterRepo({
  tableId: Tables.users,
  rowSchema: userRowSchema,
  inputSchema: userInputSchema,
  searchField: 'full_name',
})

const SHAPE_ERROR =
  'تعذّر قراءة سجل المستخدم — البنية غير متوقعة. أبلغ الدعم إذا استمر ذلك.'

/**
 * Bind (or unbind, with `null`) a user's branch. Writes the `users.branch_id`
 * profile column — the record of intent.
 *
 * TODO(story 2.1): also sync the Appwrite account pref via a shield-server
 * route. The running `Principal` reads `branchId` from `account.getPrefs()`,
 * which only a server Function can set for another user; that is out of scope
 * for the admin module, so the profile column is authoritative here.
 */
async function setBranch(userId: string, branchId: string | null): Promise<Result<User>> {
  try {
    const row = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: Tables.users,
      rowId: userId,
      data: { branch_id: branchId },
    })
    const parsed = userRowSchema.safeParse(row)
    if (!parsed.success) {
      return err(appError('server', SHAPE_ERROR, { detail: `${Tables.users}/${userId}: ${parsed.error.message}` }))
    }
    return ok(parsed.data)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export const usersRepo = { ...base, setBranch }
