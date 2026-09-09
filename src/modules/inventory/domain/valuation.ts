/**
 * Inventory valuation — Phase 4.2. Pure shaping of the `inventory_valuation`
 * RPC rows: group by warehouse with subtotals, and flatten for CSV/Excel.
 *
 * `domain` is pure TypeScript — no framework imports.
 */

export interface ValuationRow {
  productId: string
  warehouseId: string
  qty: number
  unitCost: number
  value: number
}

export interface ValuationReport {
  rows: ValuationRow[]
  totalValue: number
  lineCount: number
}

export interface WarehouseGroup {
  warehouseId: string
  rows: ValuationRow[]
  subtotal: number
}

/** One group per warehouse (RPC rows arrive warehouse-then-product ordered). */
export function groupByWarehouse(rows: readonly ValuationRow[]): WarehouseGroup[] {
  const groups = new Map<string, WarehouseGroup>()
  for (const row of rows) {
    let g = groups.get(row.warehouseId)
    if (!g) {
      g = { warehouseId: row.warehouseId, rows: [], subtotal: 0 }
      groups.set(row.warehouseId, g)
    }
    g.rows.push(row)
    g.subtotal += row.value
  }
  return [...groups.values()]
}

/** Flat `{ warehouse, product, qty, unit_cost, value }` rows for export. */
export function valuationToRows(
  report: ValuationReport,
  name: { warehouse: (id: string) => string; product: (id: string) => string },
): Array<{
  warehouse: string
  product: string
  qty: number
  unit_cost: number
  value: number
}> {
  return report.rows.map((r) => ({
    warehouse: name.warehouse(r.warehouseId),
    product: name.product(r.productId),
    qty: r.qty,
    unit_cost: r.unitCost,
    value: r.value,
  }))
}
