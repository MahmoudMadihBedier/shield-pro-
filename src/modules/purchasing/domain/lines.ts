/**
 * Helpers for the `lines` JSON **string** column shared by `purchase_orders`
 * and `stock_receipts`: string ⇄ typed array conversion, the PO total, and a
 * received-vs-ordered reconciliation used by the receipt editor.
 *
 * `domain` is pure TypeScript — no react, no appwrite imports.
 */
import type { ZodType } from 'zod'
import { z } from 'zod'

import { poLineSchema, receiptLineSchema, type PoLine, type ReceiptLine } from './schemas'

/**
 * Parse a `lines` column into a typed array. Tolerant of `null` / `undefined` /
 * `""` / `"[]"` (all → `[]`) and of malformed JSON or rows that fail the item
 * schema (→ `[]` rather than throwing across the layer).
 */
export function parseLines<T>(raw: string | null | undefined, itemSchema: ZodType<T>): T[] {
  if (raw == null) return []
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '[]') return []
  let json: unknown
  try {
    json = JSON.parse(trimmed)
  } catch {
    return []
  }
  const parsed = z.array(itemSchema).safeParse(json)
  return parsed.success ? parsed.data : []
}

/** Serialize a typed line array back to the `lines` column string. */
export function serializeLines<T>(lines: readonly T[] | null | undefined): string {
  return JSON.stringify(lines ?? [])
}

/** Parse a `purchase_orders.lines` column. */
export function parsePoLines(raw: string | null | undefined): PoLine[] {
  return parseLines(raw, poLineSchema)
}

/** Parse a `stock_receipts.lines` column. */
export function parseReceiptLines(raw: string | null | undefined): ReceiptLine[] {
  return parseLines(raw, receiptLineSchema)
}

/** Σ (qty · unit_price) over the PO lines. */
export function poTotal(lines: ReadonlyArray<{ qty: number; unit_price: number }>): number {
  return lines.reduce((sum, line) => sum + line.qty * line.unit_price, 0)
}

export interface MaterialProgress {
  raw_material_id: string
  ordered: number
  received: number
  /** `ordered - received` — negative when more was received than ordered. */
  remaining: number
  /** `received > ordered` for this material. */
  overReceived: boolean
}

export interface ReceivedVsOrdered {
  byMaterial: MaterialProgress[]
  /** `true` when any material was received in excess of what was ordered. */
  overReceived: boolean
}

/**
 * Reconcile receipt lines against the ordering PO lines, per raw material.
 * Materials keep PO order; any receipt-only material is appended. Duplicate
 * lines for the same material are summed.
 */
export function receivedVsOrdered(
  poLines: ReadonlyArray<{ raw_material_id: string; qty: number }>,
  receiptLines: ReadonlyArray<{ raw_material_id: string; qty: number }>,
): ReceivedVsOrdered {
  const orderedBy = new Map<string, number>()
  const order: string[] = []
  for (const line of poLines) {
    if (!orderedBy.has(line.raw_material_id)) order.push(line.raw_material_id)
    orderedBy.set(line.raw_material_id, (orderedBy.get(line.raw_material_id) ?? 0) + line.qty)
  }

  const receivedBy = new Map<string, number>()
  for (const line of receiptLines) {
    if (!orderedBy.has(line.raw_material_id) && !receivedBy.has(line.raw_material_id)) {
      order.push(line.raw_material_id)
    }
    receivedBy.set(line.raw_material_id, (receivedBy.get(line.raw_material_id) ?? 0) + line.qty)
  }

  const byMaterial: MaterialProgress[] = order.map((raw_material_id) => {
    const ordered = orderedBy.get(raw_material_id) ?? 0
    const received = receivedBy.get(raw_material_id) ?? 0
    return {
      raw_material_id,
      ordered,
      received,
      remaining: ordered - received,
      overReceived: received > ordered,
    }
  })

  return { byMaterial, overReceived: byMaterial.some((m) => m.overReceived) }
}
