/**
 * Zod schemas for the `accounting` module — the source of truth for the
 * `receipts` and `payment_vouchers` row shapes, kept in lockstep with
 * `scripts/appwrite/schema.ts` (`claude.md` B.2). Also the read-only
 * `general_ledger_entries` row shape and the minimal projection of
 * `sales_invoices` this module reads to build the customer-aging report.
 *
 * For each writable document there are three schemas:
 *  - `<doc>RowSchema`   — exactly what Appwrite returns: `$id` / `$createdAt` /
 *    `$updatedAt`, the ERPNext document envelope, and the document's own
 *    columns. Row-side optionals are tolerant (`null` / missing).
 *  - `<doc>DraftSchema` — the fields the client writes through
 *    `makeDocumentRepo.createDraft` / `updateDraft` (the envelope is filled by
 *    the shared document layer).
 *  - `<doc>FormSchema` — what the RHF create form submits (stricter "must pick
 *    a value" rules; trimmed text).
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

/** Row-side boolean with a schema default of `false`. */
const rowBoolFalse = z
  .boolean()
  .nullish()
  .transform((v) => v ?? false)

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
// Enums (exported as const tuples so callers can build option lists)
// ---------------------------------------------------------------------------

/** `receipts.method` — how the customer paid. */
export const RECEIPT_METHODS = ['cash', 'bank_transfer', 'post_dated_cheque'] as const
export const receiptMethodSchema = z.enum(RECEIPT_METHODS)
export type ReceiptMethod = z.infer<typeof receiptMethodSchema>

/** `payment_vouchers.direction` — money in (`receipt`) or out (`payment`). */
export const VOUCHER_DIRECTIONS = ['receipt', 'payment'] as const
export const voucherDirectionSchema = z.enum(VOUCHER_DIRECTIONS)
export type VoucherDirection = z.infer<typeof voucherDirectionSchema>

/** `sales_invoices.payment_method` — the full enum from `schema.ts`. */
export const INVOICE_PAYMENT_METHODS = [
  'cash',
  'credit',
  'bank_transfer',
  'partial',
  'post_dated_cheque',
] as const
export const invoicePaymentMethodSchema = z.enum(INVOICE_PAYMENT_METHODS)
export type InvoicePaymentMethod = z.infer<typeof invoicePaymentMethodSchema>

// ---------------------------------------------------------------------------
// receipts (Collections)
// ---------------------------------------------------------------------------

export const receiptRowSchema = z.object({
  ...systemFields,
  ...documentEnvelope,
  invoice_ref: z.string(),
  customer_id: z.string(),
  amount: rowNum0,
  method: receiptMethodSchema,
  evidence_file_id: rowOptStr,
  collected_by: rowOptStr,
})

/** Fields written by `receiptsRepo.createDraft` / `updateDraft`. */
export const receiptDraftSchema = z.object({
  invoice_ref: z.string().min(1, 'الفاتورة مطلوبة'),
  customer_id: z.string().min(1, 'العميل مطلوب'),
  amount: z.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  method: receiptMethodSchema,
  evidence_file_id: z.string().nullish(),
})

/** What the receipt create form submits. */
export const receiptFormSchema = z.object({
  invoice_ref: z.string().min(1, 'اختر فاتورة معتمدة'),
  customer_id: z.string().min(1, 'العميل مطلوب — يُملأ تلقائيًا من الفاتورة'),
  amount: z.number({ error: 'أدخل المبلغ' }).positive('أدخل مبلغًا موجبًا'),
  method: receiptMethodSchema,
  evidence_file_id: z.string().trim().max(64, 'مُعرّف مرفق طويل جدًا').optional(),
})

export type Receipt = z.infer<typeof receiptRowSchema>
export type ReceiptDraft = z.infer<typeof receiptDraftSchema>
export type ReceiptForm = z.infer<typeof receiptFormSchema>

// ---------------------------------------------------------------------------
// payment_vouchers
// ---------------------------------------------------------------------------

export const paymentVoucherRowSchema = z.object({
  ...systemFields,
  ...documentEnvelope,
  direction: voucherDirectionSchema,
  amount: rowNum0,
  reason: z.string(),
  counterparty: rowOptStr,
  treasury_account: rowOptStr,
  evidence_file_id: rowOptStr,
})

/** Fields written by `paymentVouchersRepo.createDraft` / `updateDraft`. */
export const paymentVoucherDraftSchema = z.object({
  direction: voucherDirectionSchema,
  amount: z.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  reason: z.string().min(1, 'السبب مطلوب'),
  counterparty: z.string().nullish(),
  treasury_account: z.string().nullish(),
  evidence_file_id: z.string().nullish(),
})

/** What the payment-voucher create form submits. `reason` is mandatory. */
export const paymentVoucherFormSchema = z.object({
  direction: voucherDirectionSchema,
  amount: z.number({ error: 'أدخل المبلغ' }).positive('أدخل مبلغًا موجبًا'),
  reason: z.string().trim().min(1, 'السبب مطلوب').max(512, 'السبب طويل جدًا'),
  counterparty: z.string().trim().max(128, 'اسم الطرف طويل جدًا').optional(),
  treasury_account: z.string().trim().max(64, 'اسم الخزينة طويل جدًا').optional(),
  evidence_file_id: z.string().trim().max(64, 'مُعرّف مرفق طويل جدًا').optional(),
})

export type PaymentVoucher = z.infer<typeof paymentVoucherRowSchema>
export type PaymentVoucherDraft = z.infer<typeof paymentVoucherDraftSchema>
export type PaymentVoucherForm = z.infer<typeof paymentVoucherFormSchema>

// ---------------------------------------------------------------------------
// general_ledger_entries (read-only — the only writer is an Appwrite Function)
// ---------------------------------------------------------------------------

export const glEntryRowSchema = z.object({
  ...systemFields,
  voucher_type: z.string(),
  voucher_no: z.string(),
  account: z.string(),
  branch_id: rowOptStr,
  debit: rowNum0,
  credit: rowNum0,
  posting_datetime: z.string(),
  is_cancelled: rowBoolFalse,
})

export type GlEntryRow = z.infer<typeof glEntryRowSchema>

// ---------------------------------------------------------------------------
// sales_invoices — minimal projection this module READS for the aging report.
// NOT the source of truth for the invoice row (that is `@/modules/sales`,
// built in parallel — see the task brief). Only the columns aging needs.
// ---------------------------------------------------------------------------

export const invoiceForAgingSchema = z.object({
  $id: z.string(),
  reference_id: z.string(),
  customer_id: z.string(),
  net_total: rowNum0,
  payment_method: invoicePaymentMethodSchema,
  posting_datetime: z.string(),
  doc_status: z.union([z.literal(0), z.literal(1), z.literal(2)]),
})

export type InvoiceForAging = z.infer<typeof invoiceForAgingSchema>
