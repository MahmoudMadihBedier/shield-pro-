/**
 * Zod schemas for every `admin` master-data entity — the source of truth for
 * these row shapes, kept in lockstep with `scripts/appwrite/schema.ts`
 * (`claude.md` B.2). Every other business module imports the `z.infer` types
 * exported here.
 *
 * For each entity there are two schemas:
 *  - `<entity>RowSchema`   — exactly what Appwrite returns: the `$id` /
 *    `$createdAt` / `$updatedAt` system fields plus every column.
 *  - `<entity>InputSchema` — only the user-editable fields a create/edit form
 *    submits, with the business rules baked in. Input == output type (no
 *    `.default()` at field level) so it plugs straight into the shared `Form`.
 *
 * `domain` is pure TypeScript — no react, no appwrite imports.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared column primitives
// ---------------------------------------------------------------------------

/** Appwrite system columns present on every returned row. */
const systemFields = {
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
}

/** A percentage business input, constrained to 0..100 (`claude.md` price rules). */
const percent = (label: string) =>
  z
    .number({ error: `${label}: أدخل رقمًا صحيحًا` })
    .min(0, `${label} يجب ألا تقل عن صفر`)
    .max(100, `${label} يجب ألا تتجاوز 100`)

/** A non-negative money / quantity input. */
const nonNegative = (label: string) =>
  z.number({ error: `${label}: أدخل رقمًا صحيحًا` }).min(0, `${label} يجب ألا تكون سالبة`)

/**
 * Stable identifier codes (`products.code`, `raw_materials.code`,
 * `customers.code`): required, trimmed and uppercased so lookups never drift.
 */
const codeInput = z
  .string({ error: 'الكود مطلوب' })
  .trim()
  .toUpperCase()
  .min(1, 'الكود مطلوب')
  .max(32, 'الكود طويل جدًا')

/** Optional free-text column, trimmed. Empty string is accepted (form default). */
const optText = (max: number) => z.string().trim().max(max).optional()

/** Required free-text column, trimmed. */
const reqText = (max: number, label: string) =>
  z
    .string({ error: `${label} مطلوب` })
    .trim()
    .min(1, `${label} مطلوب`)
    .max(max, `${label} طويل جدًا`)

/** Row-side optional string: Appwrite returns `null` for an unset attribute. */
const rowOptStr = z.string().nullish()
/** Row-side boolean with a schema default — older rows may omit it. */
const rowBool = z.boolean().nullish().transform((v) => v ?? true)
/** Row-side numeric with a schema default of 0. */
const rowNum0 = z.number().nullish().transform((v) => v ?? 0)

// ---------------------------------------------------------------------------
// Enums (mirror scripts/appwrite/schema.ts)
// ---------------------------------------------------------------------------

export const WAREHOUSE_KINDS = [
  'raw_store',
  'factory_custody',
  'main',
  'sub',
  'rep_custody',
] as const
export const warehouseKindSchema = z.enum(WAREHOUSE_KINDS)
export type WarehouseKind = z.infer<typeof warehouseKindSchema>

export const CUSTOMER_APPROVAL_STATES = ['approved', 'pending_approval'] as const
export const customerApprovalStateSchema = z.enum(CUSTOMER_APPROVAL_STATES)
export type CustomerApprovalState = z.infer<typeof customerApprovalStateSchema>

// ---------------------------------------------------------------------------
// branches
// ---------------------------------------------------------------------------

export const branchRowSchema = z.object({
  ...systemFields,
  name: z.string(),
  name_ar: rowOptStr,
  location: rowOptStr,
  sub_warehouse_id: rowOptStr,
  branch_accountant_id: rowOptStr,
  is_active: rowBool,
})
export const branchInputSchema = z.object({
  name: reqText(128, 'اسم الفرع'),
  name_ar: optText(128),
  location: optText(256),
  sub_warehouse_id: optText(36),
  branch_accountant_id: optText(36),
  is_active: z.boolean(),
})
export type Branch = z.infer<typeof branchRowSchema>
export type BranchInput = z.infer<typeof branchInputSchema>

// ---------------------------------------------------------------------------
// warehouses
// ---------------------------------------------------------------------------

export const warehouseRowSchema = z.object({
  ...systemFields,
  name: z.string(),
  kind: warehouseKindSchema,
  branch_id: rowOptStr,
  owner_user_id: rowOptStr,
  is_active: rowBool,
})
export const warehouseInputSchema = z.object({
  name: reqText(128, 'اسم المخزن'),
  kind: warehouseKindSchema,
  branch_id: optText(36),
  owner_user_id: optText(36),
  is_active: z.boolean(),
})
export type Warehouse = z.infer<typeof warehouseRowSchema>
export type WarehouseInput = z.infer<typeof warehouseInputSchema>

// ---------------------------------------------------------------------------
// users (profile)
// ---------------------------------------------------------------------------

export const userRowSchema = z.object({
  ...systemFields,
  auth_user_id: z.string(),
  full_name: z.string(),
  roles: rowOptStr,
  branch_id: rowOptStr,
  sub_warehouse_id: rowOptStr,
  job_grade: rowOptStr,
  is_active: rowBool,
})
/**
 * `branch_id` is deliberately NOT here: branch binding is set exclusively by the
 * System Admin through the "assign branch" action (`usersRepo.setBranch`),
 * never through the profile form (`IMPLEMENTATION_PLAN.md` §4.6).
 */
export const userInputSchema = z.object({
  auth_user_id: reqText(36, 'معرّف حساب المصادقة'),
  full_name: reqText(128, 'الاسم الكامل'),
  roles: optText(64),
  sub_warehouse_id: optText(36),
  job_grade: optText(64),
  is_active: z.boolean(),
})
export type User = z.infer<typeof userRowSchema>
export type UserInput = z.infer<typeof userInputSchema>

// ---------------------------------------------------------------------------
// products
// ---------------------------------------------------------------------------

export const productRowSchema = z.object({
  ...systemFields,
  code: z.string(),
  name: z.string(),
  name_ar: rowOptStr,
  uom: z.string(),
  base_price: z.number(),
  default_discount_pct: rowNum0,
  allowed_waste_pct: rowNum0,
  is_active: rowBool,
})
export const productInputSchema = z.object({
  code: codeInput,
  name: reqText(128, 'اسم المنتج'),
  name_ar: optText(128),
  uom: reqText(16, 'وحدة القياس'),
  /**
   * The admin-set selling price and the ONLY price field. There is no
   * per-invoice / per-sale price override anywhere in the system — the sole
   * lever on what a customer pays is their `discount_pct` (see
   * `IMPLEMENTATION_PLAN.md` §1 rule 4, "price stability").
   */
  base_price: nonNegative('السعر الأساسي'),
  default_discount_pct: percent('نسبة الخصم الافتراضية'),
  allowed_waste_pct: percent('نسبة الهالك المسموح بها'),
  is_active: z.boolean(),
})
export type Product = z.infer<typeof productRowSchema>
export type ProductInput = z.infer<typeof productInputSchema>

// ---------------------------------------------------------------------------
// product_bom
// ---------------------------------------------------------------------------

export const productBomLineRowSchema = z.object({
  ...systemFields,
  product_id: z.string(),
  raw_material_id: z.string(),
  qty_per_unit: z.number(),
})
export const productBomLineInputSchema = z.object({
  product_id: reqText(36, 'المنتج'),
  raw_material_id: reqText(36, 'الخامة'),
  qty_per_unit: z
    .number({ error: 'الكمية لكل وحدة: أدخل رقمًا صحيحًا' })
    .gt(0, 'الكمية لكل وحدة يجب أن تكون أكبر من صفر'),
})
export type ProductBomLine = z.infer<typeof productBomLineRowSchema>
export type ProductBomLineInput = z.infer<typeof productBomLineInputSchema>

// ---------------------------------------------------------------------------
// raw_materials
// ---------------------------------------------------------------------------

export const rawMaterialRowSchema = z.object({
  ...systemFields,
  code: z.string(),
  name: z.string(),
  uom: z.string(),
  purchase_price: rowNum0,
  preferred_supplier_id: rowOptStr,
  reorder_point: rowNum0,
})
export const rawMaterialInputSchema = z.object({
  code: codeInput,
  name: reqText(128, 'اسم الخامة'),
  uom: reqText(16, 'وحدة القياس'),
  purchase_price: nonNegative('سعر الشراء'),
  preferred_supplier_id: optText(36),
  reorder_point: nonNegative('حد إعادة الطلب'),
})
export type RawMaterial = z.infer<typeof rawMaterialRowSchema>
export type RawMaterialInput = z.infer<typeof rawMaterialInputSchema>

// ---------------------------------------------------------------------------
// suppliers
// ---------------------------------------------------------------------------

export const supplierRowSchema = z.object({
  ...systemFields,
  name: z.string(),
  contact: rowOptStr,
  phone: rowOptStr,
})
export const supplierInputSchema = z.object({
  name: reqText(128, 'اسم المورد'),
  contact: optText(128),
  phone: optText(32),
})
export type Supplier = z.infer<typeof supplierRowSchema>
export type SupplierInput = z.infer<typeof supplierInputSchema>

// ---------------------------------------------------------------------------
// customers
// ---------------------------------------------------------------------------

/** `geo` is stored as `"lat,lng"` — two comma-separated floats. */
export const GEO_REGEX = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/

export const customerRowSchema = z.object({
  ...systemFields,
  code: z.string(),
  name: z.string(),
  phone: rowOptStr,
  branch_id: z.string(),
  geo: rowOptStr,
  discount_pct: rowNum0,
  credit_limit: rowNum0,
  payment_terms_days: rowNum0,
  approval_state: customerApprovalStateSchema,
  created_by: rowOptStr,
  /** Links to the customer's own Appwrite Auth account for the CRM portal
   *  (`src/core/portal.ts`) — set only by the `/portal-account/*` Functions. */
  portal_user_id: rowOptStr,
})
/**
 * `approval_state` and `created_by` are NOT form fields:
 *  - `approval_state` starts at `pending_approval` and is only moved by the
 *    customer-approval workflow.
 *  - `created_by` is stamped from the acting principal in the data layer.
 */
export const customerInputSchema = z.object({
  code: codeInput,
  name: reqText(128, 'اسم العميل'),
  phone: optText(32),
  branch_id: reqText(36, 'الفرع'),
  // Mandatory on create — a customer with no location cannot be visited/served.
  geo: z
    .string({ error: 'الموقع الجغرافي مطلوب' })
    .trim()
    .regex(
      GEO_REGEX,
      'الموقع يجب أن يكون إحداثيين مفصولين بفاصلة، مثل: 30.0444,31.2357',
    ),
  discount_pct: percent('نسبة الخصم'),
  credit_limit: nonNegative('حد الائتمان'),
  payment_terms_days: z
    .number({ error: 'مدة السداد: أدخل رقمًا صحيحًا' })
    .int('مدة السداد يجب أن تكون رقمًا صحيحًا')
    .min(0, 'مدة السداد يجب ألا تكون سالبة'),
})
export type Customer = z.infer<typeof customerRowSchema>
export type CustomerInput = z.infer<typeof customerInputSchema>

/** Default `approval_state` for a freshly-created customer. */
export const DEFAULT_CUSTOMER_APPROVAL_STATE: CustomerApprovalState = 'pending_approval'
