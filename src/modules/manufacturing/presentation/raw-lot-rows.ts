/**
 * UI-side helpers for the `RawLotConsumptionEditor` rows. Kept out of the
 * component file so it stays a components-only module (oxlint
 * `react/only-export-components`).
 */
import type { RawMaterialLot } from '../domain/schemas'

/** Row shape while editing — `qty_consumed` may be blank mid-entry. */
export interface RawLotDraftRow {
  purchase_order_ref: string
  qty_consumed: string
}

export function emptyRawLotRow(): RawLotDraftRow {
  return { purchase_order_ref: '', qty_consumed: '' }
}

/** Is a row completely empty (both fields blank)? */
function isBlankRow(row: RawLotDraftRow): boolean {
  return row.purchase_order_ref.trim() === '' && row.qty_consumed.trim() === ''
}

/** Best-effort parse of the editor rows into typed lots (drops blank rows). */
export function rawLotRowsToLots(rows: readonly RawLotDraftRow[]): RawMaterialLot[] {
  return rows
    .filter((row) => !isBlankRow(row))
    .map((row) => ({
      purchase_order_ref: row.purchase_order_ref.trim(),
      qty_consumed: Number(row.qty_consumed),
    }))
}

/** Turn typed lots back into editor rows (batch edit / prefill). */
export function lotsToRawLotRows(lots: readonly RawMaterialLot[]): RawLotDraftRow[] {
  return lots.map((lot) => ({
    purchase_order_ref: lot.purchase_order_ref,
    qty_consumed: String(lot.qty_consumed),
  }))
}
