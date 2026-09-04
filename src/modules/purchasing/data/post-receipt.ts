/**
 * Post a submitted stock receipt into the immutable stock ledger.
 *
 * The client never writes a ledger row directly — it calls the
 * `/post-stock-ledger` route on `shield-server`, which allocates the entries and
 * refreshes `bin_balances`.
 *
 * Idempotency: the server keys a posting by `voucher_no` and returns a `409`
 * (mapped to `AppError.code === 'conflict'`) if that voucher was already posted.
 * A re-post is treated as a **benign success** here — `{ alreadyPosted: true }`
 * with no fresh result — because from the caller's point of view the receipt is
 * already in the ledger and nothing more needs to happen. Any other failure is
 * passed straight through as an `err(AppError)`.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { postStockLedger, type PostStockLedgerResult } from '@/infrastructure/appwrite/functions'

import { receiptToStockMoves } from '../domain/to-ledger'
import type { StockReceipt } from '../domain/schemas'

export interface ReceiptLedgerPosting {
  /** `true` when the server reported the voucher was already posted. */
  alreadyPosted: boolean
  /** The posting result, or `null` when it was already posted. */
  result: PostStockLedgerResult | null
}

export async function postReceiptToLedger(
  receipt: StockReceipt,
  rawStoreWarehouseId: string,
): Promise<Result<ReceiptLedgerPosting>> {
  const moves = receiptToStockMoves(receipt, rawStoreWarehouseId)
  if (moves.length === 0) {
    return err(appError('validation', 'لا توجد بنود في إذن الاستلام لترحيلها إلى دفتر المخزون.'))
  }

  const res = await postStockLedger({
    voucherType: 'StockReceipt',
    voucherNo: receipt.reference_id,
    postingDatetime: receipt.posting_datetime,
    moves,
  })

  if (res.ok) return ok({ alreadyPosted: false, result: res.value })
  if (res.error.code === 'conflict') return ok({ alreadyPosted: true, result: null })
  return res
}
