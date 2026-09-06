/**
 * Data layer for the two server-side rep close-out operations (Story 2.4):
 *  - `buildCloseoutExpected` — ask the server to assemble the `expected` bag
 *    from the rep's issued / sold / returned movement + cash for the day.
 *  - `confirmCloseout` — the server recomputes stock/cash variance, sets
 *    `confirmed` / `flagged`, submits the document, and notifies Admins on a
 *    flag.
 *
 * The engine lives in `supabase/migrations/0008`; presentation calls these
 * wrappers, never `@/infrastructure` directly.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import {
  buildRepCloseoutExpected as callBuildExpected,
  confirmRepCloseout as callConfirm,
  type RepCloseoutConfirmResult,
} from '@/infrastructure/appwrite/functions'

import { closeoutExpectedSchema, type CloseoutExpected } from '../domain/schemas'

export type { RepCloseoutConfirmResult }

/** Build the `expected` bag for `repUserId` on `businessDate` (`YYYY-MM-DD`). */
export async function buildCloseoutExpected(
  repUserId: string,
  businessDate: string,
): Promise<Result<CloseoutExpected>> {
  const res = await callBuildExpected(repUserId, businessDate)
  if (!res.ok) return res
  const parsed = closeoutExpectedSchema.safeParse(res.value)
  if (!parsed.success) {
    return err(
      appError('server', 'تعذّر احتساب المتوقع — بنية غير متوقعة من الخادم.', {
        detail: parsed.error.message,
      }),
    )
  }
  return ok(parsed.data)
}

/** Confirm a submitted close-out; the server is authoritative on the variances. */
export function confirmCloseout(rowId: string): Promise<Result<RepCloseoutConfirmResult>> {
  return callConfirm(rowId)
}
