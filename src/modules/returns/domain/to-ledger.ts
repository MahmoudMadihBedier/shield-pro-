/**
 * Pure stock-move builder for a return request. Turns the returned lines into
 * the flat list of `{ productId, warehouseId, qtyChange }` moves that the
 * `post-stock-ledger` Function consumes. Signs only — no balances, no I/O.
 *
 * Goods coming back always increase stock, so every move is a **positive**
 * `qtyChange` into the warehouse the user picked for the return — never a
 * direct edit of an existing balance (`IMPLEMENTATION_PLAN.md` §1 principle 5:
 * corrections are new reversing documents, not mutations).
 *
 * v1 keeps this simple and does not value the return (`valuationRate` is
 * omitted) — the original document's valuation isn't threaded through here;
 * revisit if returns need to affect average cost.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import type { ReturnLine } from './schemas'

/** Mirrors `StockMoveInput` in `infrastructure/appwrite/functions.ts`. */
export interface StockMove {
  productId: string
  warehouseId: string
  lotNumber?: string | null
  qtyChange: number
  valuationRate?: number
}

export interface ReturnMoveInput {
  lines: readonly ReturnLine[]
}

/** Each line becomes one IN move (`+qty`) into `warehouseId`. */
export function returnToStockMoves(
  returnRequest: ReturnMoveInput,
  warehouseId: string,
): StockMove[] {
  return returnRequest.lines.map((line) => ({
    productId: line.product_id,
    warehouseId,
    qtyChange: line.qty,
  }))
}
