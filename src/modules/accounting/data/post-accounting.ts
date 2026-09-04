/**
 * Post a submitted accounting document into the immutable general ledger.
 *
 * The client never writes a GL row directly — it calls the `/post-gl` route on
 * `shield-server`, which re-checks `Σ debit === Σ credit` and rejects a voucher
 * that was already posted.
 *
 * ## Idempotency
 * `/post-gl` is keyed by `voucher_no`. A re-post returns a `409` (mapped to
 * `AppError.code === 'conflict'`). These helpers absorb that as a benign
 * success — `{ alreadyPosted: true }` — so a double-click / refetch-then-post /
 * resumed flow is a no-op rather than a user-facing error. Any other failure
 * propagates unchanged.
 */
import { err, ok, type Result } from '@/core/result'
import { postGl, type PostGlResult } from '@/infrastructure/appwrite/functions'

import { receiptToGlLines, voucherToGlLines } from '../domain/gl'
import type { PaymentVoucher, Receipt } from '../domain/schemas'

export interface GlPosting {
  voucherNo: string
  /** `true` when the server reported the voucher was already posted. */
  alreadyPosted: boolean
  /** The fresh post result, or `null` when `alreadyPosted`. */
  posted: PostGlResult | null
}

function absorbAlreadyPosted(voucherNo: string, result: Result<PostGlResult>): Result<GlPosting> {
  if (result.ok) return ok({ voucherNo, alreadyPosted: false, posted: result.value })
  if (result.error.code === 'conflict') return ok({ voucherNo, alreadyPosted: true, posted: null })
  return err(result.error)
}

export async function postReceiptToGl(receipt: Receipt): Promise<Result<GlPosting>> {
  const result = await postGl({
    voucherType: 'Receipt',
    voucherNo: receipt.reference_id,
    postingDatetime: receipt.posting_datetime,
    branchId: receipt.branch_id,
    lines: receiptToGlLines(receipt),
  })
  return absorbAlreadyPosted(receipt.reference_id, result)
}

export async function postVoucherToGl(voucher: PaymentVoucher): Promise<Result<GlPosting>> {
  const result = await postGl({
    voucherType: 'PaymentVoucher',
    voucherNo: voucher.reference_id,
    postingDatetime: voucher.posting_datetime,
    branchId: voucher.branch_id,
    lines: voucherToGlLines(voucher),
  })
  return absorbAlreadyPosted(voucher.reference_id, result)
}
