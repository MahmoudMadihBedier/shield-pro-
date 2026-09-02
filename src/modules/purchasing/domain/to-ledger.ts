/**
 * Pure mapping from a submitted stock receipt to the stock-ledger moves that
 * post it into inventory. The data layer (`data/post-receipt.ts`) feeds these
 * to the `/post-stock-ledger` Function — nothing here knows about appwrite.
 *
 * `domain` is pure TypeScript — no react, no appwrite imports.
 */
import { parseReceiptLines } from './lines'
import type { StockReceipt } from './schemas'

/**
 * One inventory move. Structurally compatible with `StockMoveInput` from
 * `@/infrastructure/appwrite/functions` (which is what consumes it), but
 * declared here so the domain layer stays framework-free.
 */
export interface StockMove {
  productId: string
  warehouseId: string
  lotNumber: string | null
  qtyChange: number
  valuationRate: number
}

/**
 * Each receipt line becomes a positive move into the raw-store warehouse,
 * tagged with the supplier's lot number and valued at the line's unit price.
 */
export function receiptToStockMoves(
  receipt: Pick<StockReceipt, 'lines' | 'supplier_lot_number'>,
  rawStoreWarehouseId: string,
): StockMove[] {
  const lotNumber = receipt.supplier_lot_number ?? null
  return parseReceiptLines(receipt.lines).map((line) => ({
    productId: line.raw_material_id,
    warehouseId: rawStoreWarehouseId,
    lotNumber,
    qtyChange: line.qty,
    valuationRate: line.unit_price,
  }))
}
