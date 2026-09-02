/**
 * Pure BOM explosion helper. Manufacturing (`production_requests` /
 * `production_batches`) reuses this to turn a product's bill of materials plus a
 * planned quantity into the raw-material demand.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import type { ProductBomLine } from './schemas'

export interface RawMaterialDemand {
  rawMaterialId: string
  qty: number
}

/** The fields `explodeBom` actually needs from a BOM line. */
export type BomLineLike = Pick<ProductBomLine, 'raw_material_id' | 'qty_per_unit'>

/**
 * Multiply every line's `qty_per_unit` by `qty` (the planned production
 * quantity). Lines that reference the same raw material are summed, so the
 * result has one entry per raw material. Order follows first appearance.
 *
 * Throws on a non-finite / negative `qty` — a planned quantity must be a real,
 * non-negative number.
 */
export function explodeBom(lines: readonly BomLineLike[], qty: number): RawMaterialDemand[] {
  if (!Number.isFinite(qty) || qty < 0) {
    throw new Error(`explodeBom: planned qty must be a finite non-negative number, got ${qty}`)
  }

  const order: string[] = []
  const totals = new Map<string, number>()

  for (const line of lines) {
    const current = totals.get(line.raw_material_id)
    if (current === undefined) {
      order.push(line.raw_material_id)
      totals.set(line.raw_material_id, line.qty_per_unit * qty)
    } else {
      totals.set(line.raw_material_id, current + line.qty_per_unit * qty)
    }
  }

  return order.map((rawMaterialId) => ({ rawMaterialId, qty: totals.get(rawMaterialId)! }))
}
