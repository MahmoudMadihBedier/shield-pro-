/**
 * Zod schemas for the `inventory` module — the source of truth for the
 * `warehouse_transfers`, `stock_count_sessions`, `write_offs` and `bin_balances`
 * row shapes, kept in lockstep with `scripts/appwrite/schema.ts` (`claude.md`
 * B.2). Every other layer derives its types from here (`z.infer`).
 *
 * For each submittable document there is:
 *  - `<entity>RowSchema`   — exactly what Appwrite returns (envelope + system
 *    fields + the module columns). `lines` / `counts` / `variances` stay raw
 *    JSON strings here; `line-utils` / `variance` parse them into typed rows.
 *  - `<entity>DraftSchema` — the create form shape (React Hook Form + Zod).
 *  - `<entity>WriteFields` — the plain field bag handed to `makeDocumentRepo`
 *    (`lines` already serialised to a string).
 *
 * `domain` is pure TypeScript — no react / appwrite / vite imports (Zod is the
 * project's runtime-validation primitive and is allowed, see `src/core`).
 */
import { z } from 'zod'

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
// Status / kind enums (mirror scripts/appwrite/schema.ts)
// ---------------------------------------------------------------------------

/** `warehouse_transfers.status` — the quadruple-step workflow state. */
export const TRANSFER_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'executed',
  'received',
] as const
export const transferStatusSchema = z.enum(TRANSFER_STATUSES)
export type TransferStatus = z.infer<typeof transferStatusSchema>

/** `stock_count_sessions.status`. */
export const COUNT_SESSION_STATUSES = ['open', 'submitted', 'signed_off'] as const
export const countSessionStatusSchema = z.enum(COUNT_SESSION_STATUSES)
export type CountSessionStatus = z.infer<typeof countSessionStatusSchema>

/** `write_offs.kind`. */
export const WRITE_OFF_KINDS = ['damage', 'loss', 'scrap'] as const
export const writeOffKindSchema = z.enum(WRITE_OFF_KINDS)
export type WriteOffKind = z.infer<typeof writeOffKindSchema>

// ---------------------------------------------------------------------------
// Parsed JSON line shapes
// ---------------------------------------------------------------------------

export const transferLineSchema = z.object({
  product_id: z.string(),
  qty: z.number().positive(),
  lot_number: z.string().optional().nullable(),
})
export type TransferLine = z.infer<typeof transferLineSchema>

export const countLineSchema = z.object({
  product_id: z.string(),
  counted_qty: z.number().nonnegative(),
})
export type CountLine = z.infer<typeof countLineSchema>

export const varianceLineSchema = z.object({
  product_id: z.string(),
  recorded_qty: z.number(),
  counted_qty: z.number(),
  variance: z.number(),
})
export type VarianceLine = z.infer<typeof varianceLineSchema>

/** Same shape as a transfer line. */
export const writeOffLineSchema = z.object({
  product_id: z.string(),
  qty: z.number().positive(),
  lot_number: z.string().optional().nullable(),
})
export type WriteOffLine = z.infer<typeof writeOffLineSchema>

// ---------------------------------------------------------------------------
// warehouse_transfers
// ---------------------------------------------------------------------------

export const warehouseTransferRowSchema = documentRowSchema.extend({
  from_warehouse_id: z.string(),
  to_warehouse_id: z.string(),
  /** Raw JSON — parse with `parseLines(row.lines, transferLineSchema)`. */
  lines: z.string(),
  status: transferStatusSchema,
  requested_by: rowOptStr,
  approved_by: rowOptStr,
  sent_by: rowOptStr,
  confirmed_received_by: rowOptStr,
})
export type WarehouseTransferRow = z.infer<typeof warehouseTransferRowSchema>

/** Create-form shape. Same-warehouse is blocked in the form page, not here. */
export const warehouseTransferDraftSchema = z.object({
  from_warehouse_id: z.string().min(1, 'اختر مخزن المصدر'),
  to_warehouse_id: z.string().min(1, 'اختر مخزن الوجهة'),
  lines: z.array(transferLineSchema).min(1, 'أضف صنفًا واحدًا على الأقل'),
})
export type WarehouseTransferDraft = z.infer<typeof warehouseTransferDraftSchema>

/**
 * Field bag handed to `makeDocumentRepo` (envelope fields are derived there).
 * A `type` (not `interface`) so it satisfies the factory's
 * `Record<string, unknown>` constraint.
 */
export type WarehouseTransferWriteFields = {
  from_warehouse_id: string
  to_warehouse_id: string
  lines: string
  status: TransferStatus
  requested_by?: string | null
  approved_by?: string | null
  sent_by?: string | null
  confirmed_received_by?: string | null
}

// ---------------------------------------------------------------------------
// stock_count_sessions
// ---------------------------------------------------------------------------

export const stockCountSessionRowSchema = documentRowSchema.extend({
  warehouse_id: z.string(),
  /** Raw JSON `CountLine[]`. */
  counts: rowOptStr,
  /** Raw JSON `VarianceLine[]` — filled when the session is submitted. */
  variances: rowOptStr,
  status: countSessionStatusSchema,
  signed_off_by: rowOptStr,
})
export type StockCountSessionRow = z.infer<typeof stockCountSessionRowSchema>

export const stockCountSessionDraftSchema = z.object({
  warehouse_id: z.string().min(1, 'اختر المخزن'),
})
export type StockCountSessionDraft = z.infer<typeof stockCountSessionDraftSchema>

export type StockCountSessionWriteFields = {
  warehouse_id: string
  counts: string
  variances?: string | null
  status: CountSessionStatus
  signed_off_by?: string | null
}

// ---------------------------------------------------------------------------
// write_offs
// ---------------------------------------------------------------------------

export const writeOffRowSchema = documentRowSchema.extend({
  warehouse_id: z.string(),
  /** Raw JSON `WriteOffLine[]`. */
  lines: z.string(),
  kind: writeOffKindSchema,
  reason: z.string(),
  requested_by: rowOptStr,
  approved_by: rowOptStr,
})
export type WriteOffRow = z.infer<typeof writeOffRowSchema>

export const writeOffDraftSchema = z.object({
  warehouse_id: z.string().min(1, 'اختر المخزن'),
  kind: writeOffKindSchema,
  reason: z.string().trim().min(1, 'سبب الهالك مطلوب').max(512, 'السبب طويل جدًا'),
  lines: z.array(writeOffLineSchema).min(1, 'أضف صنفًا واحدًا على الأقل'),
})
export type WriteOffDraft = z.infer<typeof writeOffDraftSchema>

export type WriteOffWriteFields = {
  warehouse_id: string
  lines: string
  kind: WriteOffKind
  reason: string
  requested_by?: string | null
  approved_by?: string | null
}

// ---------------------------------------------------------------------------
// bin_balances (read-only projection of the stock ledger)
// ---------------------------------------------------------------------------

export const binBalanceRowSchema = z.object({
  $id: z.string(),
  $createdAt: z.string().optional(),
  $updatedAt: z.string().optional(),
  product_id: z.string(),
  warehouse_id: z.string(),
  qty: z.number(),
  updated_datetime: z.string(),
})
export type BinBalance = z.infer<typeof binBalanceRowSchema>
