/**
 * Post a submitted production batch to the immutable stock ledger.
 *
 * Ordering: this runs AFTER `productionBatchesRepo.submit(id)` has flipped the
 * document to Submitted. The client never writes a ledger row directly — it
 * calls the `/post-stock-ledger` route on `shield-server`, which validates and
 * appends the entries and refreshes `bin_balances`.
 *
 * Idempotency: the server keys a posting by `voucher_no` (here the batch's
 * `reference_id`) and rejects a voucher it has already posted. A repeat call
 * therefore comes back as `err(AppError)` with `code === 'conflict'` — callers
 * should treat that as "already posted" (a non-blocking notice), NOT as a
 * failure to retry. `isAlreadyPosted` is the guard for that.
 */
import type { AppError } from '@/core/errors'
import { err, type Result } from '@/core/result'
import {
  postStockLedger,
  type PostStockLedgerResult,
} from '@/infrastructure/appwrite/functions'

import { parseRawMaterialLots } from '../domain/planning'
import type { ProductionBatch } from '../domain/schemas'
import { batchToStockMoves } from '../domain/to-ledger'

export interface BatchLedgerWarehouseIds {
  factoryCustodyWarehouseId: string
  rawStoreWarehouseId: string
}

/** True when a `postBatchToLedger` failure just means the voucher was already posted. */
export function isAlreadyPosted(error: AppError): boolean {
  return error.code === 'conflict'
}

export async function postBatchToLedger(
  batch: ProductionBatch,
  warehouses: BatchLedgerWarehouseIds,
): Promise<Result<PostStockLedgerResult>> {
  const lots = parseRawMaterialLots(batch.raw_material_lots)
  if (!lots.ok) return err(lots.error)

  const moves = batchToStockMoves(
    {
      product_id: batch.product_id,
      lot_number: batch.lot_number,
      produced_qty: batch.produced_qty,
      expected_cost: batch.expected_cost,
      raw_material_lots: lots.value,
    },
    warehouses,
  )

  return postStockLedger({
    voucherType: 'ProductionBatch',
    voucherNo: batch.reference_id,
    postingDatetime: batch.posting_datetime,
    moves,
  })
}
