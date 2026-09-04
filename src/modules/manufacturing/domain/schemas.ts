/**
 * Zod schemas for the `manufacturing` module — `production_requests` and
 * `production_batches`. Kept in lockstep with `scripts/appwrite/schema.ts`
 * (`claude.md` B.2); `schema.ts` is authoritative for column names, types and
 * enum members.
 *
 * For each entity there are:
 *  - `<entity>RowSchema`   — exactly what Appwrite returns: the `$id` /
 *    `$createdAt` / `$updatedAt` system fields, the shared document envelope,
 *    and the entity's own columns. JSON string columns stay strings here — see
 *    `planning.ts` for the parse/serialize helpers.
 *  - `<entity>DraftSchema` — the module-owned fields the client writes through
 *    `makeDocumentRepo` (the envelope is added by the shared repo).
 *
 * `domain` is pure TypeScript — no react, no appwrite imports.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Enums (mirror scripts/appwrite/schema.ts)
// ---------------------------------------------------------------------------

/** `production_requests.status` enum members, in schema order. */
export const PRODUCTION_REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'issued'] as const
export const productionRequestStatusSchema = z.enum(PRODUCTION_REQUEST_STATUSES)
export type ProductionRequestStatus = z.infer<typeof productionRequestStatusSchema>

/** `production_batches.qc_status` enum members, in schema order. */
export const QC_STATUSES = ['pending_qc', 'released', 'rejected'] as const
export const qcStatusSchema = z.enum(QC_STATUSES)
export type QcStatus = z.infer<typeof qcStatusSchema>

// ---------------------------------------------------------------------------
// Parsed shapes for the JSON string columns
// ---------------------------------------------------------------------------

/** One line of `production_requests.required_materials` (BOM demand). */
export const requiredMaterialLineSchema = z.object({
  raw_material_id: z.string(),
  qty: z.number().nonnegative(),
})
export type RequiredMaterialLine = z.infer<typeof requiredMaterialLineSchema>

/** One line of `production_batches.raw_material_lots` (consumed PO lot). */
export const rawMaterialLotSchema = z.object({
  purchase_order_ref: z.string(),
  qty_consumed: z.number().positive(),
})
export type RawMaterialLot = z.infer<typeof rawMaterialLotSchema>

// ---------------------------------------------------------------------------
// Shared column primitives
// ---------------------------------------------------------------------------

/** Appwrite system columns present on every returned row. */
const systemFields = {
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
}

/**
 * The ERPNext-style document envelope every submittable table carries
 * (`scripts/appwrite/schema.ts` → `documentEnvelope`). Parsed defensively — an
 * Appwrite row is an untyped record until it clears this.
 */
const documentEnvelopeRow = {
  reference_id: z.string(),
  doc_status: z.number().int(),
  branch_id: z.string().nullish(),
  created_by: z.string(),
  amended_from: z.string().nullish(),
  posting_datetime: z.string(),
  remarks: z.string().nullish(),
}

/** Row-side JSON string column: Appwrite returns `null` when never written. */
const rowJson = z
  .string()
  .nullish()
  .transform((v) => v ?? '[]')
/** Row-side numeric with a schema default of 0 — older rows may omit it. */
const rowNum0 = z
  .number()
  .nullish()
  .transform((v) => v ?? 0)
const rowOptStr = z.string().nullish()

// ---------------------------------------------------------------------------
// production_requests
// ---------------------------------------------------------------------------

export const productionRequestRowSchema = z.object({
  ...systemFields,
  ...documentEnvelopeRow,
  product_id: z.string(),
  planned_qty: z.number(),
  required_materials: rowJson,
  status: productionRequestStatusSchema,
})
export type ProductionRequest = z.infer<typeof productionRequestRowSchema>

/**
 * Fields the client writes through `productionRequestsRepo.createDraft` /
 * `.updateDraft`. `status` is included so the detail screen can drive the
 * `pending → approved → issued` workflow through `updateDraft` while the request
 * is still a Draft.
 */
export const productionRequestDraftSchema = z.object({
  product_id: z.string().min(1),
  planned_qty: z.number().nonnegative(),
  required_materials: z.string(),
  status: productionRequestStatusSchema.optional(),
  /** Free-text envelope column — carries a reject reason when a request is turned down. */
  remarks: z.string().optional(),
})
export type ProductionRequestDraft = z.infer<typeof productionRequestDraftSchema>

/** RHF form values for {@link productionRequestDraftSchema} creation. */
export const productionRequestFormSchema = z.object({
  product_id: z.string({ error: 'اختر المنتج' }).min(1, 'اختر المنتج'),
  planned_qty: z
    .number({ error: 'الكمية المخططة: أدخل رقمًا صحيحًا' })
    .positive('الكمية المخططة يجب أن تكون أكبر من صفر'),
})
export type ProductionRequestFormValues = z.infer<typeof productionRequestFormSchema>

// ---------------------------------------------------------------------------
// production_batches
// ---------------------------------------------------------------------------

export const productionBatchRowSchema = z.object({
  ...systemFields,
  ...documentEnvelopeRow,
  production_request_ref: rowOptStr,
  product_id: z.string(),
  lot_number: z.string(),
  produced_qty: z.number(),
  waste_qty: rowNum0,
  raw_material_lots: rowJson,
  expected_cost: rowNum0,
  expected_profit: rowNum0,
  qc_status: qcStatusSchema,
  qc_by: rowOptStr,
  expiry_date: rowOptStr,
})
export type ProductionBatch = z.infer<typeof productionBatchRowSchema>

/**
 * Fields the client writes through `productionBatchesRepo.createDraft` /
 * `.updateDraft`. `qc_status` / `qc_by` are here because QC happens through
 * `updateDraft` while the batch is a Draft, *before* submit (see
 * `presentation/components/QcActionBar.tsx`).
 */
export const productionBatchDraftSchema = z.object({
  production_request_ref: z.string().optional(),
  product_id: z.string().min(1),
  lot_number: z.string().min(1),
  produced_qty: z.number().nonnegative(),
  waste_qty: z.number().nonnegative(),
  raw_material_lots: z.string(),
  expected_cost: z.number(),
  expected_profit: z.number(),
  expiry_date: z.string().optional(),
  qc_status: qcStatusSchema.optional(),
  qc_by: z.string().optional(),
  /** Free-text envelope column — carries the QC reject reason. */
  remarks: z.string().optional(),
})
export type ProductionBatchDraft = z.infer<typeof productionBatchDraftSchema>

/**
 * RHF form values for batch creation. `raw_material_lots` is edited by the
 * standalone `RawLotConsumptionEditor` (local state) and merged + validated on
 * submit, so it is not part of the RHF schema.
 */
export const productionBatchFormSchema = z.object({
  production_request_ref: z.string().optional(),
  product_id: z.string({ error: 'اختر المنتج' }).min(1, 'اختر المنتج'),
  lot_number: z
    .string({ error: 'رقم التشغيلة مطلوب' })
    .trim()
    .min(1, 'رقم التشغيلة مطلوب')
    .max(64, 'رقم التشغيلة طويل جدًا'),
  produced_qty: z
    .number({ error: 'الكمية المنتجة: أدخل رقمًا صحيحًا' })
    .positive('الكمية المنتجة يجب أن تكون أكبر من صفر'),
  waste_qty: z
    .number({ error: 'كمية الهالك: أدخل رقمًا صحيحًا' })
    .min(0, 'كمية الهالك يجب ألا تكون سالبة'),
  expiry_date: z.string().optional(),
})
export type ProductionBatchFormValues = z.infer<typeof productionBatchFormSchema>
