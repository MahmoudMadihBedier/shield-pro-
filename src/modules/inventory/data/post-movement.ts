/**
 * Ledger-posting helpers for the three inventory movements. Each maps the
 * document to stock moves via the pure `to-ledger` builders and calls the
 * `post-stock-ledger` Function with a fixed `voucherType` and `voucherNo` set
 * to the document's `reference_id`.
 *
 * ## Idempotency
 * `post-stock-ledger` is idempotent by `voucher_no`: the server rejects a
 * voucher that was already posted (an `AppError` with code `conflict`). These
 * helpers absorb that case and resolve to `ok({ alreadyPosted: true })` so a
 * retry (double-click, refetch-then-post, a resumed flow) is a no-op rather
 * than a user-facing error. Any other failure propagates unchanged.
 */
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import {
  postStockLedger,
  type PostStockLedgerResult,
} from '@/infrastructure/appwrite/functions'

import {
  countAdjustmentToStockMoves,
  transferToStockMoves,
  writeOffToStockMoves,
} from '../domain/to-ledger'
import { parseLines } from '../domain/line-utils'
import {
  transferLineSchema,
  writeOffLineSchema,
  type VarianceLine,
  type WarehouseTransferRow,
  type WriteOffRow,
} from '../domain/schemas'

export const InventoryVoucherType = {
  WarehouseTransfer: 'WarehouseTransfer',
  WriteOff: 'WriteOff',
  StockCountAdjustment: 'StockCountAdjustment',
} as const

export interface LedgerPostResult {
  voucherNo: string
  /** `true` when the voucher was already on the ledger — this call was a no-op. */
  alreadyPosted: boolean
  /** The fresh post result, or `null` when `alreadyPosted`. */
  posted: PostStockLedgerResult | null
}

function absorbAlreadyPosted(
  voucherNo: string,
  result: Result<PostStockLedgerResult>,
): Result<LedgerPostResult> {
  if (result.ok) return ok({ voucherNo, alreadyPosted: false, posted: result.value })
  if (result.error.code === 'conflict') {
    return ok({ voucherNo, alreadyPosted: true, posted: null })
  }
  return err(result.error)
}

export async function postTransferToLedger(
  transfer: WarehouseTransferRow,
): Promise<Result<LedgerPostResult>> {
  let moves
  try {
    moves = transferToStockMoves({
      from_warehouse_id: transfer.from_warehouse_id,
      to_warehouse_id: transfer.to_warehouse_id,
      lines: parseLines(transfer.lines, transferLineSchema),
    })
  } catch (e) {
    return err(
      appError('validation', 'تعذّرت قراءة أصناف التحويل. راجع المستند وحاول مجددًا.', {
        detail: e instanceof Error ? e.message : String(e),
      }),
    )
  }

  const result = await postStockLedger({
    voucherType: InventoryVoucherType.WarehouseTransfer,
    voucherNo: transfer.reference_id,
    postingDatetime: transfer.posting_datetime,
    moves,
  })
  return absorbAlreadyPosted(transfer.reference_id, result)
}

export async function postWriteOffToLedger(
  writeOff: WriteOffRow,
): Promise<Result<LedgerPostResult>> {
  let moves
  try {
    moves = writeOffToStockMoves({
      warehouse_id: writeOff.warehouse_id,
      lines: parseLines(writeOff.lines, writeOffLineSchema),
    })
  } catch (e) {
    return err(
      appError('validation', 'تعذّرت قراءة أصناف الهالك. راجع المستند وحاول مجددًا.', {
        detail: e instanceof Error ? e.message : String(e),
      }),
    )
  }

  const result = await postStockLedger({
    voucherType: InventoryVoucherType.WriteOff,
    voucherNo: writeOff.reference_id,
    postingDatetime: writeOff.posting_datetime,
    moves,
  })
  return absorbAlreadyPosted(writeOff.reference_id, result)
}

export interface CountAdjustmentSession {
  reference_id: string
  warehouse_id: string
  posting_datetime: string
}

export async function postCountAdjustmentToLedger(
  session: CountAdjustmentSession,
  variances: readonly VarianceLine[],
): Promise<Result<LedgerPostResult>> {
  const moves = countAdjustmentToStockMoves({ warehouse_id: session.warehouse_id }, variances)

  const result = await postStockLedger({
    voucherType: InventoryVoucherType.StockCountAdjustment,
    voucherNo: session.reference_id,
    postingDatetime: session.posting_datetime,
    moves,
  })
  return absorbAlreadyPosted(session.reference_id, result)
}
