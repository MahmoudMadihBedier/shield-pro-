/**
 * Read side of the accounting period lock (`system_settings` row
 * `id = 'posting_lock_date'`). The write side is the `set_posting_lock_date`
 * RPC (`@/infrastructure/appwrite/functions`) — this table carries no client
 * write policy at all, matching every other control table.
 */
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { tablesDB } from '@/infrastructure/appwrite/services'

const settingRowSchema = z.object({
  $id: z.string(),
  value: z.string(),
})

/** `null` when no lock is currently set. */
export async function getPostingLockDate(): Promise<Result<string | null>> {
  try {
    const row = await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId: Tables.systemSettings,
      rowId: 'posting_lock_date',
    })
    const parsed = settingRowSchema.safeParse(row)
    if (!parsed.success) {
      return err(
        appError('server', 'تعذّر قراءة تاريخ إغلاق الفترة المحاسبية.', {
          detail: parsed.error.message,
        }),
      )
    }
    return ok(parsed.data.value)
  } catch (e) {
    const mapped = mapAppwriteError(e)
    // No lock set yet is expected, not an error — the row simply doesn't exist.
    if (mapped.code === 'not_found') return ok(null)
    return err(mapped)
  }
}
