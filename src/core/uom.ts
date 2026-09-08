/**
 * Units of measure. Every raw material and product carries exactly one stock
 * unit from this fixed list — the quantity in every ledger, BOM line and
 * document is expressed in that item's stock unit, so no cross-unit conversion
 * ever happens inside the stock math. A product may additionally define
 * alternate *sale* units (a qty + a factor to the stock unit) — see
 * `src/modules/admin/domain/schemas.ts` `sale_units`.
 *
 * `core` has ZERO framework imports — plain TypeScript + Zod only.
 */
import { z } from 'zod'

/**
 * Canonical unit codes. Kept short (matches ERP convention and the existing
 * seed data — `pc`, `kg`). Add here only; never rename (values are persisted).
 */
export const UNITS = [
  'pc',
  'kg',
  'g',
  'ton',
  'l',
  'ml',
  'box',
  'carton',
  'dozen',
  'pack',
  'bag',
  'roll',
  'sheet',
  'm',
  'cm',
] as const

export const unitSchema = z.enum(UNITS)
export type Unit = z.infer<typeof unitSchema>

export const DEFAULT_UNIT: Unit = 'pc'

/** Bilingual label per unit. */
export const UNIT_LABELS: Record<Unit, { ar: string; en: string }> = {
  pc: { ar: 'قطعة', en: 'piece' },
  kg: { ar: 'كيلوجرام', en: 'kg' },
  g: { ar: 'جرام', en: 'g' },
  ton: { ar: 'طن', en: 'ton' },
  l: { ar: 'لتر', en: 'litre' },
  ml: { ar: 'مليلتر', en: 'ml' },
  box: { ar: 'صندوق', en: 'box' },
  carton: { ar: 'كرتونة', en: 'carton' },
  dozen: { ar: 'دستة', en: 'dozen' },
  pack: { ar: 'عبوة', en: 'pack' },
  bag: { ar: 'كيس', en: 'bag' },
  roll: { ar: 'لفة', en: 'roll' },
  sheet: { ar: 'لوح', en: 'sheet' },
  m: { ar: 'متر', en: 'm' },
  cm: { ar: 'سنتيمتر', en: 'cm' },
}

/** `"قطعة / piece"` — for a picker option or an inline qty suffix. */
export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return ''
  const known = UNIT_LABELS[unit as Unit]
  return known ? `${known.ar} / ${known.en}` : unit
}

/** Short Arabic label only (`"قطعة"`), falling back to the raw code. */
export function unitShort(unit: string | null | undefined): string {
  if (!unit) return ''
  return UNIT_LABELS[unit as Unit]?.ar ?? unit
}

/** `{ value, label }[]` for a `<SelectField>` / `<select>`. */
export const UNIT_OPTIONS: ReadonlyArray<{ value: Unit; label: string }> = UNITS.map((u) => ({
  value: u,
  label: unitLabel(u),
}))

/** Format a quantity with its unit suffix, e.g. `"12 كرتونة"`. */
export function formatQtyWithUnit(qty: number, unit: string | null | undefined): string {
  const u = unitShort(unit)
  return u ? `${qty} ${u}` : String(qty)
}
