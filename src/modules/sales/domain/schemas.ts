/**
 * Zod schemas for the `sales` module — the source of truth for the
 * `sales_invoices`, `rep_stock_issues` and `rep_closeouts` row shapes, plus the
 * two read-only rep ledgers (`rep_stock_ledger`, `rep_cash_ledger`). Kept in
 * lockstep with `scripts/appwrite/schema.ts` (`claude.md` B.2); every other
 * layer derives its types from here with `z.infer`.
 *
 * For each submittable document there is:
 *  - `<entity>RowSchema`    — exactly what Appwrite returns (envelope + system
 *    fields + module columns). `lines` / `expected` / `actual` stay raw JSON
 *    strings; the helpers below parse them into typed rows.
 *  - `<entity>DraftSchema`  — the create-form shape (React Hook Form + Zod).
 *  - `<entity>WriteFields`  — the plain field bag handed to `makeDocumentRepo`
 *    (`lines` etc. already serialised to a string).
 *
 * `domain` is pure TypeScript — no react / appwrite / vite imports (Zod is the
 * project's runtime-validation primitive and is allowed, see `src/core`).
 */
import { z, type ZodType } from 'zod'

import { documentEnvelopeSchema } from '@/core/document'

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

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
// Status / method enums (mirror scripts/appwrite/schema.ts) — const tuples
// ---------------------------------------------------------------------------

/** `sales_invoices.payment_method`. */
export const PAYMENT_METHODS = [
  'cash',
  'credit',
  'bank_transfer',
  'partial',
  'post_dated_cheque',
] as const
export const paymentMethodSchema = z.enum(PAYMENT_METHODS)
export type PaymentMethod = z.infer<typeof paymentMethodSchema>

/** `rep_stock_issues.status` — the request → approve → issue workflow. */
export const REP_ISSUE_STATUSES = ['pending', 'approved', 'rejected', 'issued'] as const
export const repIssueStatusSchema = z.enum(REP_ISSUE_STATUSES)
export type RepIssueStatus = z.infer<typeof repIssueStatusSchema>

/** `rep_closeouts.status` — open → submitted → confirmed, or auto-flagged. */
export const CLOSEOUT_STATUSES = ['open', 'submitted', 'confirmed', 'flagged'] as const
export const closeoutStatusSchema = z.enum(CLOSEOUT_STATUSES)
export type CloseoutStatus = z.infer<typeof closeoutStatusSchema>

/** Cash-bucket methods reconciled at close-out (mirrors `rep_cash_ledger.method`). */
export const CLOSEOUT_CASH_METHODS = ['cash', 'bank_transfer', 'post_dated_cheque'] as const
export const closeoutCashMethodSchema = z.enum(CLOSEOUT_CASH_METHODS)
export type CloseoutCashMethod = z.infer<typeof closeoutCashMethodSchema>

// ---------------------------------------------------------------------------
// Parsed JSON line shapes
// ---------------------------------------------------------------------------

/**
 * A priced invoice line. `base_price` is copied from the product's admin-set
 * price (never overridden — `IMPLEMENTATION_PLAN.md` §1 rule 4), `discount_pct`
 * is the only lever, `net_price` is the derived per-unit price after discount.
 */
export const invoiceLineSchema = z.object({
  product_id: z.string(),
  qty: z.number().positive(),
  base_price: z.number().nonnegative(),
  discount_pct: z.number().min(0).max(100),
  net_price: z.number().nonnegative(),
})
export type InvoiceLine = z.infer<typeof invoiceLineSchema>

export const repIssueLineSchema = z.object({
  product_id: z.string(),
  qty: z.number().positive(),
  lot_number: z.string().optional().nullable(),
})
export type RepIssueLine = z.infer<typeof repIssueLineSchema>

/** One product row in the close-out `expected` bag (from issues / sales / returns). */
export const closeoutExpectedProductSchema = z.object({
  product_id: z.string(),
  issued: z.number(),
  sold: z.number(),
  returned: z.number(),
  remaining: z.number(),
})
export type CloseoutExpectedProduct = z.infer<typeof closeoutExpectedProductSchema>

/** One product row in the close-out `actual` bag (physical count). */
export const closeoutActualProductSchema = z.object({
  product_id: z.string(),
  counted: z.number(),
})
export type CloseoutActualProduct = z.infer<typeof closeoutActualProductSchema>

/** A cash figure by method — used on both the expected and the actual side. */
export const closeoutCashSchema = z.object({
  method: closeoutCashMethodSchema,
  amount: z.number(),
})
export type CloseoutCash = z.infer<typeof closeoutCashSchema>

/** `rep_closeouts.expected` JSON — issued/sold/returned/remaining + expected cash. */
export const closeoutExpectedSchema = z.object({
  products: z.array(closeoutExpectedProductSchema),
  cash: z.array(closeoutCashSchema),
})
export type CloseoutExpected = z.infer<typeof closeoutExpectedSchema>

/** `rep_closeouts.actual` JSON — physical stock count + counted cash. */
export const closeoutActualSchema = z.object({
  products: z.array(closeoutActualProductSchema),
  cash: z.array(closeoutCashSchema),
})
export type CloseoutActual = z.infer<typeof closeoutActualSchema>

// ---------------------------------------------------------------------------
// JSON column helpers
// ---------------------------------------------------------------------------

/** Serialise a list of line rows to the JSON string stored in Appwrite. */
export function serializeJsonArray<T>(rows: readonly T[]): string {
  return JSON.stringify(rows)
}

/** Parse + validate a JSON array column. An absent / empty column is an empty list. */
export function parseJsonArray<T>(raw: string | null | undefined, schema: ZodType<T>): T[] {
  if (raw == null || raw.trim() === '') return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('sales: JSON column holds malformed JSON')
  }
  const result = z.array(schema).safeParse(parsed)
  if (!result.success) {
    throw new Error(`sales: JSON column failed validation — ${result.error.message}`)
  }
  return result.data
}

/** Parse + validate a JSON object column against `schema`. */
export function parseJsonObject<T>(raw: string | null | undefined, schema: ZodType<T>): T | null {
  if (raw == null || raw.trim() === '') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('sales: JSON column holds malformed JSON')
  }
  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`sales: JSON column failed validation — ${result.error.message}`)
  }
  return result.data
}

export const parseInvoiceLines = (raw: string | null | undefined): InvoiceLine[] =>
  parseJsonArray(raw, invoiceLineSchema)
export const parseRepIssueLines = (raw: string | null | undefined): RepIssueLine[] =>
  parseJsonArray(raw, repIssueLineSchema)
export const parseCloseoutExpected = (raw: string | null | undefined): CloseoutExpected | null =>
  parseJsonObject(raw, closeoutExpectedSchema)
export const parseCloseoutActual = (raw: string | null | undefined): CloseoutActual | null =>
  parseJsonObject(raw, closeoutActualSchema)

// ---------------------------------------------------------------------------
// sales_invoices
// ---------------------------------------------------------------------------

export const salesInvoiceRowSchema = documentRowSchema.extend({
  customer_id: z.string(),
  rep_user_id: z.string(),
  /** Raw JSON — parse with `parseInvoiceLines(row.lines)`. */
  lines: z.string(),
  gross_total: z.number(),
  discount_total: z.number(),
  net_total: z.number(),
  payment_method: paymentMethodSchema,
  cash_amount: z.number(),
  credit_amount: z.number(),
  bank_reference: rowOptStr,
  /** Locked rep geolocation at issue time — `"lat,lng"`. Mandatory. */
  geo: z.string(),
  sold_by: rowOptStr,
  cashup_confirmed_by: rowOptStr,
})
export type SalesInvoiceRow = z.infer<typeof salesInvoiceRowSchema>

/** `"lat,lng"` — two comma-separated floats (mirrors admin's customer geo). */
export const GEO_REGEX = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/

export const salesInvoiceDraftSchema = z.object({
  customer_id: z.string().min(1, 'اختر العميل'),
  rep_user_id: z.string().min(1, 'اختر المندوب'),
  lines: z.array(invoiceLineSchema).min(1, 'أضف صنفًا واحدًا على الأقل'),
  payment_method: paymentMethodSchema,
  /** Cash portion — only meaningful for `partial`; derived otherwise. */
  cash_amount: z.number().min(0).optional(),
  bank_reference: z.string().trim().max(64).optional().nullable(),
  geo: z
    .string({ error: 'الموقع الجغرافي مطلوب' })
    .trim()
    .regex(GEO_REGEX, 'الموقع يجب أن يكون إحداثيين مفصولين بفاصلة، مثل: 30.0444,31.2357'),
})
export type SalesInvoiceDraft = z.infer<typeof salesInvoiceDraftSchema>

export type SalesInvoiceWriteFields = {
  customer_id: string
  rep_user_id: string
  lines: string
  gross_total: number
  discount_total: number
  net_total: number
  payment_method: PaymentMethod
  cash_amount: number
  credit_amount: number
  bank_reference?: string | null
  geo: string
  sold_by?: string | null
  cashup_confirmed_by?: string | null
}

// ---------------------------------------------------------------------------
// rep_stock_issues
// ---------------------------------------------------------------------------

export const repStockIssueRowSchema = documentRowSchema.extend({
  sub_warehouse_id: z.string(),
  rep_user_id: z.string(),
  /** Raw JSON — parse with `parseRepIssueLines(row.lines)`. */
  lines: z.string(),
  status: repIssueStatusSchema,
  requested_by: rowOptStr,
  approved_by: rowOptStr,
})
export type RepStockIssueRow = z.infer<typeof repStockIssueRowSchema>

export const repStockIssueDraftSchema = z.object({
  sub_warehouse_id: z.string().min(1, 'اختر المخزن الفرعي'),
  rep_user_id: z.string().min(1, 'اختر المندوب'),
  lines: z.array(repIssueLineSchema).min(1, 'أضف صنفًا واحدًا على الأقل'),
})
export type RepStockIssueDraft = z.infer<typeof repStockIssueDraftSchema>

export type RepStockIssueWriteFields = {
  sub_warehouse_id: string
  rep_user_id: string
  lines: string
  status: RepIssueStatus
  requested_by?: string | null
  approved_by?: string | null
}

// ---------------------------------------------------------------------------
// rep_closeouts
// ---------------------------------------------------------------------------

export const repCloseoutRowSchema = documentRowSchema.extend({
  rep_user_id: z.string(),
  business_date: z.string(),
  /** Raw JSON `CloseoutExpected` — parse with `parseCloseoutExpected`. */
  expected: rowOptStr,
  /** Raw JSON `CloseoutActual` — parse with `parseCloseoutActual`. */
  actual: rowOptStr,
  stock_variance: z.number(),
  cash_variance: z.number(),
  status: closeoutStatusSchema,
  confirmed_by: rowOptStr,
})
export type RepCloseoutRow = z.infer<typeof repCloseoutRowSchema>

/** `"YYYY-MM-DD"`. */
export const BUSINESS_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const repCloseoutDraftSchema = z.object({
  rep_user_id: z.string().min(1, 'اختر المندوب'),
  business_date: z.string().trim().regex(BUSINESS_DATE_REGEX, 'اختر تاريخ يوم العمل'),
})
export type RepCloseoutDraft = z.infer<typeof repCloseoutDraftSchema>

export type RepCloseoutWriteFields = {
  rep_user_id: string
  business_date: string
  expected: string
  actual: string
  stock_variance: number
  cash_variance: number
  status: CloseoutStatus
  confirmed_by?: string | null
}

// ---------------------------------------------------------------------------
// rep_stock_ledger / rep_cash_ledger (read-only, Function-written)
// ---------------------------------------------------------------------------

export const repStockLedgerRowSchema = z.object({
  ...systemFields,
  rep_user_id: z.string(),
  product_id: z.string(),
  voucher_no: z.string(),
  qty_change: z.number(),
  qty_after: z.number(),
  posting_datetime: z.string(),
})
export type RepStockLedgerRow = z.infer<typeof repStockLedgerRowSchema>

export const repCashLedgerRowSchema = z.object({
  ...systemFields,
  rep_user_id: z.string(),
  voucher_no: z.string(),
  method: closeoutCashMethodSchema.nullish(),
  amount_change: z.number(),
  amount_after: z.number(),
  posting_datetime: z.string(),
})
export type RepCashLedgerRow = z.infer<typeof repCashLedgerRowSchema>
