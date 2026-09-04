/**
 * Production planning helpers — turn a product's bill of materials + a planned
 * quantity into the `required_materials` line shape, and (de)serialize the two
 * JSON string columns.
 *
 * BOM explosion itself is NOT re-implemented here — it delegates to admin's
 * `explodeBom` (`@/modules/admin`). This module only reshapes the result to the
 * `required_materials` column contract.
 *
 * `domain` is pure TypeScript — no react, no appwrite imports.
 */
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { explodeBom, type BomLineLike } from '@/modules/admin'

import {
  rawMaterialLotSchema,
  requiredMaterialLineSchema,
  type RawMaterialLot,
  type RequiredMaterialLine,
} from './schemas'

/**
 * BOM demand for `plannedQty` units, shaped to the `required_materials` column
 * (`{ raw_material_id, qty }`). Thin wrapper over admin's `explodeBom`.
 *
 * Throws (via `explodeBom`) on a non-finite / negative `plannedQty`.
 */
export function requiredMaterialsFor(
  bomLines: readonly BomLineLike[],
  plannedQty: number,
): RequiredMaterialLine[] {
  return explodeBom(bomLines, plannedQty).map((demand) => ({
    raw_material_id: demand.rawMaterialId,
    qty: demand.qty,
  }))
}

const requiredMaterialsArraySchema = z.array(requiredMaterialLineSchema)
const rawMaterialLotsArraySchema = z.array(rawMaterialLotSchema)

const PARSE_ERROR = 'تعذّر قراءة بيانات المكوّنات — البنية غير متوقعة.'

function parseJsonArray<T>(raw: string, schema: z.ZodType<T[]>): Result<T[]> {
  let json: unknown
  try {
    json = raw.trim() === '' ? [] : JSON.parse(raw)
  } catch {
    return err(appError('validation', PARSE_ERROR, { detail: `not JSON: ${raw.slice(0, 200)}` }))
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return err(appError('validation', PARSE_ERROR, { detail: parsed.error.message }))
  }
  return ok(parsed.data)
}

/** Serialize `required_materials` lines to the JSON string column. */
export function serializeRequiredMaterials(lines: readonly RequiredMaterialLine[]): string {
  return JSON.stringify(lines)
}

/** Parse the `required_materials` JSON string column. */
export function parseRequiredMaterials(raw: string): Result<RequiredMaterialLine[]> {
  return parseJsonArray(raw, requiredMaterialsArraySchema)
}

/** Serialize `raw_material_lots` lines to the JSON string column. */
export function serializeRawMaterialLots(lots: readonly RawMaterialLot[]): string {
  return JSON.stringify(lots)
}

/** Parse the `raw_material_lots` JSON string column. */
export function parseRawMaterialLots(raw: string): Result<RawMaterialLot[]> {
  return parseJsonArray(raw, rawMaterialLotsArraySchema)
}
