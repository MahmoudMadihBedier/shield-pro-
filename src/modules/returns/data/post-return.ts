/**
 * Ledger-posting helper for a return request. Maps the document to stock moves
 * via the pure `to-ledger` builder and calls the `post-stock-ledger` Function
 * with a fixed `voucherType` and `voucherNo` set to the document's
 * `reference_id`.
 *
 * ## Idempotency
 * `post-stock-ledger` is idempotent by `voucher_no`: the server rejects a
 * voucher that was already posted (an `AppError` with code `conflict`). This
 * helper absorbs that case and resolves to `ok({ alreadyPosted: true })` so a
 * retry (double-click, refetch-then-post, a resumed flow) is a no-op rather
 * than a user-facing error. Any other failure propagates unchanged. Mirrors
 * `src/modules/inventory/data/post-movement.ts`.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { postStockLedger, type PostStockLedgerResult } from '@/infrastructure/appwrite/functions'

import { returnToStockMoves } from '../domain/to-ledger'
import { parseReturnLines, type ReturnRequestRow } from '../domain/schemas'

export const ReturnsVoucherType = {
  ReturnRequest: 'ReturnRequest',
} as const

export interface ReturnLedgerPostResult {
  voucherNo: string
  /** `true` when the voucher was already on the ledger — this call was a no-op. */
  alreadyPosted: boolean
  /** The fresh post result, or `null` when `alreadyPosted`. */
  posted: PostStockLedgerResult | null
}

export async function postReturnToLedger(
  returnRequest: ReturnRequestRow,
  warehouseId: string,
): Promise<Result<ReturnLedgerPostResult>> {
  let moves
  try {
    moves = returnToStockMoves({ lines: parseReturnLines(returnRequest.lines) }, warehouseId)
  } catch (e) {
    return err(
      appError('validation', 'تعذّرت قراءة أصناف المرتجع. راجع المستند وحاول مجددًا.', {
        detail: e instanceof Error ? e.message : String(e),
      }),
    )
  }

  const result = await postStockLedger({
    voucherType: ReturnsVoucherType.ReturnRequest,
    voucherNo: returnRequest.reference_id,
    postingDatetime: returnRequest.posting_datetime,
    moves,
  })

  if (result.ok) {
    return ok({ voucherNo: returnRequest.reference_id, alreadyPosted: false, posted: result.value })
  }
  if (result.error.code === 'conflict') {
    return ok({ voucherNo: returnRequest.reference_id, alreadyPosted: true, posted: null })
  }
  return err(result.error)
}
