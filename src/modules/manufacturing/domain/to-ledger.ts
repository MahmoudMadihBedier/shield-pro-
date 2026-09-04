/**
 * Translate a submitted production batch into the stock movements that must be
 * posted to the immutable stock ledger:
 *
 *  - every consumed raw-material lot → an OUT move from the raw store
 *    (`qtyChange` negative),
 *  - the finished product → one IN move to factory custody, carrying the batch
 *    lot number and a unit valuation rate of `expected_cost / produced_qty`.
 *
 * Pure — no react, no appwrite imports. The data layer (`data/post-batch.ts`)
 * hands the result to `/post-stock-ledger`.
 */
import type { RawMaterialLot } from './schemas'

/**
 * One stock movement line. Structurally the `StockMoveInput` the
 * `/post-stock-ledger` route accepts (negative `qtyChange` = consumption).
 */
export interface StockMove {
  productId: string
  warehouseId: string
  lotNumber?: string
  qtyChange: number
  valuationRate?: number
}

export interface BatchLedgerWarehouses {
  factoryCustodyWarehouseId: string
  rawStoreWarehouseId: string
}

/**
 * The subset of a parsed {@link ProductionBatch} `batchToStockMoves` needs.
 * `raw_material_lots` is already parsed (see `planning.parseRawMaterialLots`).
 */
export interface BatchForLedger {
  product_id: string
  lot_number: string
  produced_qty: number
  expected_cost: number
  raw_material_lots: readonly RawMaterialLot[]
}

export function batchToStockMoves(
  batch: BatchForLedger,
  warehouses: BatchLedgerWarehouses,
): StockMove[] {
  const rawOut: StockMove[] = batch.raw_material_lots.map((lot) => ({
    // The lot shape only carries `purchase_order_ref`; the Function resolves it
    // to the concrete raw material when it posts.
    productId: lot.purchase_order_ref,
    warehouseId: warehouses.rawStoreWarehouseId,
    qtyChange: -lot.qty_consumed,
  }))

  const valuationRate =
    batch.produced_qty > 0 ? batch.expected_cost / batch.produced_qty : 0

  const finishedIn: StockMove = {
    productId: batch.product_id,
    warehouseId: warehouses.factoryCustodyWarehouseId,
    lotNumber: batch.lot_number,
    qtyChange: batch.produced_qty,
    valuationRate,
  }

  return [...rawOut, finishedIn]
}
