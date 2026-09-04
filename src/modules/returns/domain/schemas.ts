/**
 * Zod schemas for the `returns` module — the source of truth for the
 * `return_requests` row shape, kept in lockstep with `scripts/appwrite/schema.ts`
 * (`claude.md` B.2). Every other layer derives its types from here (`z.infer`).
 *
 * `returnRequestRowSchema`   — exactly what Appwrite returns (envelope + system
 *   fields + module columns). `lines` stays a raw JSON string here; the JSON
 *   helpers below parse it into typed rows.
 * `returnRequestDraftSchema` — the create-form shape (React Hook Form + Zod).
 * `ReturnRequestWriteFields` — the plain field bag handed to `makeDocumentRepo`
 *   (`lines` already serialised to a string).
 *
 * A return can reverse a sale (`INV-`), a transfer (`TRF-`) or a raw-material
 * receipt (`SR-`) — see `./origin`. This module never imports `@/modules/sales`
 * or `@/modules/inventory`; it works off `origin_ref`'s prefix alone.
 *
 * `domain` is pure TypeScript — no react / appwrite / vite imports (Zod is the
 * project's runtime-validation primitive and is allowed, see `src/core`).
 */
import { z, type ZodType } from 'zod'

import { documentEnvelopeSchema } from '@/core/document'

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Appwrite system columns present on every returned row. */
const systemFields = {
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
}

/** Row-side optional string — Appwrite returns `null` for an unset attribute. */
const rowOptStr = z.string().nullish()

/** The ERPNext-style document envelope plus the Appwrite system fields. */
const documentRowSchema = documentEnvelopeSchema.extend(systemFields)

// ---------------------------------------------------------------------------
// status enum (mirrors scripts/appwrite/schema.ts)
// ---------------------------------------------------------------------------

/** `return_requests.status` — the approval workflow state. */
export const RETURN_STATUSES = ['pending', 'approved', 'rejected'] as const
export const returnStatusSchema = z.enum(RETURN_STATUSES)
export type ReturnStatus = z.infer<typeof returnStatusSchema>

// ---------------------------------------------------------------------------
// Parsed JSON line shape
// ---------------------------------------------------------------------------

export const returnLineSchema = z.object({
  product_id: z.string(),
  qty: z.number().positive(),
  reason_detail: z.string().optional().nullable(),
})
export type ReturnLine = z.infer<typeof returnLineSchema>

// ---------------------------------------------------------------------------
// JSON column helpers
// ---------------------------------------------------------------------------

/** Serialise a list of line rows to the JSON string stored in Appwrite. */
export function serializeReturnLines(lines: readonly ReturnLine[]): string {
  return JSON.stringify(lines)
}

/** Parse + validate the `lines` JSON column. An absent / empty column is an empty list. */
export function parseReturnLines(raw: string | null | undefined): ReturnLine[] {
  return parseJsonArray(raw, returnLineSchema)
}

function parseJsonArray<T>(raw: string | null | undefined, schema: ZodType<T>): T[] {
  if (raw == null || raw.trim() === '') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('returns: line column holds malformed JSON')
  }
  const result = z.array(schema).safeParse(parsed)
  if (!result.success) {
    throw new Error(`returns: line column failed validation — ${result.error.message}`)
  }
  return result.data
}

// ---------------------------------------------------------------------------
// return_requests
// ---------------------------------------------------------------------------

export const returnRequestRowSchema = documentRowSchema.extend({
  /** The `INV-` / `TRF-` / `SR-` reference being reversed. */
  origin_ref: z.string(),
  /** Raw JSON — parse with `parseReturnLines(row.lines)`. */
  lines: z.string(),
  reason: z.string(),
  status: returnStatusSchema,
  requested_by: rowOptStr,
  approved_by: rowOptStr,
})
export type ReturnRequestRow = z.infer<typeof returnRequestRowSchema>

export const returnRequestDraftSchema = z.object({
  origin_ref: z.string().trim().min(1, 'أدخل مرجع المستند الأصلي'),
  reason: z.string().trim().min(1, 'سبب الإرجاع مطلوب').max(512, 'السبب طويل جدًا'),
  lines: z.array(returnLineSchema).min(1, 'أضف صنفًا واحدًا على الأقل'),
})
export type ReturnRequestDraft = z.infer<typeof returnRequestDraftSchema>

/**
 * Field bag handed to `makeDocumentRepo` (envelope fields are derived there).
 * A `type` (not `interface`) so it satisfies the factory's
 * `Record<string, unknown>` constraint.
 */
export type ReturnRequestWriteFields = {
  origin_ref: string
  lines: string
  reason: string
  status: ReturnStatus
  requested_by?: string | null
  approved_by?: string | null
}
