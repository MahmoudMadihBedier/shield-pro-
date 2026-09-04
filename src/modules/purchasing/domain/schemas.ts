/**
 * Zod schemas for the `purchasing` module — the source of truth for the
 * `purchase_orders` and `stock_receipts` row shapes, kept in lockstep with
 * `scripts/appwrite/schema.ts` (`claude.md` B.2).
 *
 * For each document there are three schemas:
 *  - `<doc>RowSchema`   — exactly what Appwrite returns: the `$id` / `$createdAt`
 *    / `$updatedAt` system fields, the ERPNext document envelope, and the
 *    document's own columns. Row-side optionals are tolerant (`null` / missing).
 *  - `<doc>DraftSchema` — the fields the client writes through
 *    `makeDocumentRepo.createDraft` / `updateDraft` (the envelope is filled by
 *    the shared document layer). `lines` is the serialized JSON string column.
 *  - `<doc>FormSchema` — what the RHF create/edit form submits: `lines` as a
 *    typed array, plus the stricter "must pick a value" rules.
 *
 * `lines` is a JSON **string** column; the parsed element shapes are
 * `poLineSchema` / `receiptLineSchema`.
 *
 * `domain` is pure TypeScript — no react, no appwrite imports.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared primitives (mirror scripts/appwrite/schema.ts column types)
// ---------------------------------------------------------------------------

/** Appwrite system columns present on every returned row. */
const systemFields = {
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
}

/** Row-side optional string: Appwrite returns `null` for an unset attribute. */
const rowOptStr = z.string().nullish()
/** Row-side numeric with a schema default of 0. */
const rowNum0 = z
  .number()
  .nullish()
  .transform((v) => v ?? 0)

/**
 * The columns `documentEnvelope` adds to every submittable table
 * (`scripts/appwrite/schema.ts`). `doc_status` is `0 | 1 | 2` — the
 * `DocStatus` union from `@/core/doc-status`.
 */
const documentEnvelope = {
  reference_id: z.string(),
  doc_status: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  branch_id: rowOptStr,
  created_by: z.string(),
  amended_from: rowOptStr,
  posting_datetime: z.string(),
  remarks: rowOptStr,
}

// ---------------------------------------------------------------------------
// Line-item element shapes (parsed out of the `lines` JSON string column)
// ---------------------------------------------------------------------------

/** One ordered raw-material line on a purchase order. */
export const poLineSchema = z.object({
  raw_material_id: z.string(),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative(),
})

/** One received raw-material line on a stock receipt. */
export const receiptLineSchema = z.object({
  raw_material_id: z.string(),
  qty: z.number().positive(),
  unit_price: z.number().nonnegative(),
})

/** Form-side PO line: the raw material must actually be chosen. */
export const poLineFormSchema = poLineSchema.extend({
  raw_material_id: z.string().min(1, 'اختر الخامة'),
})

/** Form-side receipt line: the raw material must actually be chosen. */
export const receiptLineFormSchema = receiptLineSchema.extend({
  raw_material_id: z.string().min(1, 'اختر الخامة'),
})

// ---------------------------------------------------------------------------
// purchase_orders
// ---------------------------------------------------------------------------

export const purchaseOrderRowSchema = z.object({
  ...systemFields,
  ...documentEnvelope,
  supplier_id: z.string(),
  lines: rowOptStr,
  total_value: rowNum0,
})

/** Fields written by `purchaseOrdersRepo.createDraft` / `updateDraft`. */
export const purchaseOrderDraftSchema = z.object({
  supplier_id: z.string().min(1, 'المورد مطلوب'),
  /** Serialized `poLineSchema[]`. */
  lines: z.string(),
  total_value: z.number().nonnegative(),
})

/** What the PO create/edit form submits. */
export const purchaseOrderFormSchema = z.object({
  supplier_id: z.string().min(1, 'اختر المورد'),
  lines: z.array(poLineFormSchema).min(1, 'أضف بندًا واحدًا على الأقل'),
})

export type PurchaseOrder = z.infer<typeof purchaseOrderRowSchema>
export type PurchaseOrderDraft = z.infer<typeof purchaseOrderDraftSchema>
export type PurchaseOrderForm = z.infer<typeof purchaseOrderFormSchema>
export type PoLine = z.infer<typeof poLineSchema>

// ---------------------------------------------------------------------------
// stock_receipts
// ---------------------------------------------------------------------------

export const stockReceiptRowSchema = z.object({
  ...systemFields,
  ...documentEnvelope,
  purchase_order_ref: z.string(),
  supplier_lot_number: rowOptStr,
  lines: rowOptStr,
})

/** Fields written by `stockReceiptsRepo.createDraft` / `updateDraft`. */
export const stockReceiptDraftSchema = z.object({
  purchase_order_ref: z.string().min(1, 'أمر الشراء مطلوب'),
  supplier_lot_number: z.string().nullish(),
  /** Serialized `receiptLineSchema[]`. */
  lines: z.string(),
})

/** What the stock-receipt create/edit form submits. */
export const stockReceiptFormSchema = z.object({
  purchase_order_ref: z.string().min(1, 'اختر أمر شراء معتمدًا'),
  supplier_lot_number: z.string().trim().min(1, 'رقم تشغيلة المورد مطلوب').max(64, 'رقم طويل جدًا'),
  lines: z.array(receiptLineFormSchema).min(1, 'أضف بندًا واحدًا على الأقل'),
})

export type StockReceipt = z.infer<typeof stockReceiptRowSchema>
export type StockReceiptDraft = z.infer<typeof stockReceiptDraftSchema>
export type StockReceiptForm = z.infer<typeof stockReceiptFormSchema>
export type ReceiptLine = z.infer<typeof receiptLineSchema>
