/**
 * Pure stock-move builders. Each turns an inventory document into the flat list
 * of `{ productId, warehouseId, lotNumber?, qtyChange }` moves that the
 * `post-stock-ledger` Function consumes. Signs only — no balances, no I/O.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import type { TransferLine, VarianceLine, WriteOffLine } from './schemas'

/** Mirrors `StockMoveInput` in `infrastructure/appwrite/functions.ts`. */
export interface StockMove {
  productId: string
  warehouseId: string
  lotNumber?: string | null
  qtyChange: number
  valuationRate?: number
}

export interface TransferMoveInput {
  from_warehouse_id: string
  to_warehouse_id: string
  lines: readonly TransferLine[]
}

/**
 * Each line becomes two moves: OUT of the source warehouse (`-qty`) and IN to
 * the destination warehouse (`+qty`), both carrying the line's `lot_number`.
 */
export function transferToStockMoves(transfer: TransferMoveInput): StockMove[] {
  const moves: StockMove[] = []
  for (const line of transfer.lines) {
    moves.push({
      productId: line.product_id,
      warehouseId: transfer.from_warehouse_id,
      lotNumber: line.lot_number ?? null,
      qtyChange: -line.qty,
    })
    moves.push({
      productId: line.product_id,
      warehouseId: transfer.to_warehouse_id,
      lotNumber: line.lot_number ?? null,
      qtyChange: line.qty,
    })
  }
  return moves
}

export interface WriteOffMoveInput {
  warehouse_id: string
  lines: readonly WriteOffLine[]
}

/** Each line becomes one OUT move from the write-off's warehouse (`-qty`). */
export function writeOffToStockMoves(writeOff: WriteOffMoveInput): StockMove[] {
  return writeOff.lines.map((line) => ({
    productId: line.product_id,
    warehouseId: writeOff.warehouse_id,
    lotNumber: line.lot_number ?? null,
    qtyChange: -line.qty,
  }))
}

export interface CountAdjustmentInput {
  warehouse_id: string
}

/**
 * Each non-zero variance becomes one move whose `qtyChange` is the variance
 * itself — the delta that reconciles the `bin_balances` projection to the
 * physical count.
 */
export function countAdjustmentToStockMoves(
  session: CountAdjustmentInput,
  variances: readonly VarianceLine[],
): StockMove[] {
  return variances
    .filter((line) => line.variance !== 0)
    .map((line) => ({
      productId: line.product_id,
      warehouseId: session.warehouse_id,
      qtyChange: line.variance,
    }))
}
