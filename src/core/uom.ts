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

// ---------------------------------------------------------------------------
// Sale units — a product may be sold in units other than its stock unit
// ---------------------------------------------------------------------------

/**
 * One alternate selling unit for a product. `factor` = how many of the
 * product's STOCK units make up one of this sale unit (e.g. a carton of 12
 * bottles → `{ unit: 'carton', factor: 12 }`). `label` overrides the default
 * unit label for display (e.g. `"كرتونة (12)"`).
 */
export const saleUnitSchema = z.object({
  unit: unitSchema,
  factor: z.number().positive(),
  label: z.string().trim().max(40).optional(),
})
export type SaleUnit = z.infer<typeof saleUnitSchema>

/** A resolved, ready-to-render sale unit: always has a `label`. */
export interface ResolvedSaleUnit {
  unit: Unit
  factor: number
  label: string
}

/** Parse the `products.sale_units` JSON column; anything malformed → `[]`. */
export function parseSaleUnits(raw: string | null | undefined): SaleUnit[] {
  if (raw == null || raw.trim() === '') return []
  try {
    const parsed = z.array(saleUnitSchema).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

/** Serialise for the `sale_units` column. */
export function serializeSaleUnits(list: readonly SaleUnit[]): string {
  return JSON.stringify(list)
}

/**
 * The full option list for a product's sale-unit picker: the stock unit
 * (factor 1) first, then the configured alternates, de-duplicated by `unit`.
 */
export function resolveSaleUnits(
  stockUnit: string | null | undefined,
  raw: string | null | undefined,
): ResolvedSaleUnit[] {
  const baseUnit: Unit = unitSchema.safeParse(stockUnit).success
    ? (stockUnit as Unit)
    : DEFAULT_UNIT
  const base: ResolvedSaleUnit = { unit: baseUnit, factor: 1, label: unitShort(baseUnit) }
  const seen = new Set<string>([base.unit])
  const out: ResolvedSaleUnit[] = [base]
  for (const su of parseSaleUnits(raw)) {
    if (seen.has(su.unit) || su.factor <= 0) continue
    seen.add(su.unit)
    out.push({ unit: su.unit, factor: su.factor, label: su.label?.trim() || unitShort(su.unit) })
  }
  return out
}

/** Stock (base) quantity for `saleQty` of a unit with the given `factor`. */
export function toBaseQty(saleQty: number, factor: number): number {
  return saleQty * factor
}
