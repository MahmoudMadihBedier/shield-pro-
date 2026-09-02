/**
 * Arabic-first (with English gloss) display labels for the `admin` master-data
 * entities, their columns and their enum values. Presentation reads these so no
 * module hard-codes a field label.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import type { CustomerApprovalState, WarehouseKind } from './schemas'

export interface Label {
  ar: string
  en: string
}

export type AdminEntity =
  | 'branch'
  | 'warehouse'
  | 'user'
  | 'product'
  | 'productBom'
  | 'rawMaterial'
  | 'supplier'
  | 'customer'

/** Entity titles — singular + plural, for headers and nav. */
export const ENTITY_LABELS: Record<AdminEntity, { one: Label; many: Label }> = {
  branch: { one: { ar: 'فرع', en: 'Branch' }, many: { ar: 'الفروع', en: 'Branches' } },
  warehouse: {
    one: { ar: 'مخزن', en: 'Warehouse' },
    many: { ar: 'المخازن', en: 'Warehouses' },
  },
  user: {
    one: { ar: 'مستخدم', en: 'User' },
    many: { ar: 'المستخدمون', en: 'Users' },
  },
  product: {
    one: { ar: 'منتج', en: 'Product' },
    many: { ar: 'المنتجات', en: 'Products' },
  },
  productBom: {
    one: { ar: 'مكوّن قائمة مواد', en: 'BOM line' },
    many: { ar: 'قائمة المواد', en: 'Bill of materials' },
  },
  rawMaterial: {
    one: { ar: 'خامة', en: 'Raw material' },
    many: { ar: 'الخامات', en: 'Raw materials' },
  },
  supplier: {
    one: { ar: 'مورد', en: 'Supplier' },
    many: { ar: 'الموردون', en: 'Suppliers' },
  },
  customer: {
    one: { ar: 'عميل', en: 'Customer' },
    many: { ar: 'العملاء', en: 'Customers' },
  },
}

/** Column labels, keyed by entity then column name. */
export const FIELD_LABELS: Record<AdminEntity, Record<string, Label>> = {
  branch: {
    name: { ar: 'الاسم', en: 'Name' },
    name_ar: { ar: 'الاسم بالعربية', en: 'Name (Arabic)' },
    location: { ar: 'الموقع', en: 'Location' },
    sub_warehouse_id: { ar: 'المخزن الفرعي', en: 'Sub-warehouse' },
    branch_accountant_id: { ar: 'محاسب الفرع', en: 'Branch accountant' },
    is_active: { ar: 'نشط', en: 'Active' },
  },
  warehouse: {
    name: { ar: 'الاسم', en: 'Name' },
    kind: { ar: 'النوع', en: 'Kind' },
    branch_id: { ar: 'الفرع', en: 'Branch' },
    owner_user_id: { ar: 'المسؤول', en: 'Owner' },
    is_active: { ar: 'نشط', en: 'Active' },
  },
  user: {
    auth_user_id: { ar: 'معرّف حساب المصادقة', en: 'Auth account id' },
    full_name: { ar: 'الاسم الكامل', en: 'Full name' },
    roles: { ar: 'الأدوار', en: 'Roles' },
    branch_id: { ar: 'الفرع', en: 'Branch' },
    sub_warehouse_id: { ar: 'المخزن الفرعي', en: 'Sub-warehouse' },
    job_grade: { ar: 'الدرجة الوظيفية', en: 'Job grade' },
    is_active: { ar: 'نشط', en: 'Active' },
  },
  product: {
    code: { ar: 'الكود', en: 'Code' },
    name: { ar: 'الاسم', en: 'Name' },
    name_ar: { ar: 'الاسم بالعربية', en: 'Name (Arabic)' },
    uom: { ar: 'وحدة القياس', en: 'Unit' },
    base_price: { ar: 'السعر الأساسي', en: 'Base price' },
    default_discount_pct: { ar: 'نسبة الخصم الافتراضية %', en: 'Default discount %' },
    allowed_waste_pct: { ar: 'نسبة الهالك المسموح بها %', en: 'Allowed waste %' },
    is_active: { ar: 'نشط', en: 'Active' },
  },
  productBom: {
    product_id: { ar: 'المنتج', en: 'Product' },
    raw_material_id: { ar: 'الخامة', en: 'Raw material' },
    qty_per_unit: { ar: 'الكمية لكل وحدة', en: 'Qty per unit' },
  },
  rawMaterial: {
    code: { ar: 'الكود', en: 'Code' },
    name: { ar: 'الاسم', en: 'Name' },
    uom: { ar: 'وحدة القياس', en: 'Unit' },
    purchase_price: { ar: 'سعر الشراء', en: 'Purchase price' },
    preferred_supplier_id: { ar: 'المورد المفضّل', en: 'Preferred supplier' },
    reorder_point: { ar: 'حد إعادة الطلب', en: 'Reorder point' },
  },
  supplier: {
    name: { ar: 'الاسم', en: 'Name' },
    contact: { ar: 'جهة الاتصال', en: 'Contact' },
    phone: { ar: 'الهاتف', en: 'Phone' },
  },
  customer: {
    code: { ar: 'الكود', en: 'Code' },
    name: { ar: 'الاسم', en: 'Name' },
    phone: { ar: 'الهاتف', en: 'Phone' },
    branch_id: { ar: 'الفرع', en: 'Branch' },
    geo: { ar: 'الموقع الجغرافي', en: 'Geo (lat,lng)' },
    discount_pct: { ar: 'نسبة الخصم %', en: 'Discount %' },
    credit_limit: { ar: 'حد الائتمان', en: 'Credit limit' },
    payment_terms_days: { ar: 'مدة السداد (يوم)', en: 'Payment terms (days)' },
    approval_state: { ar: 'حالة الاعتماد', en: 'Approval state' },
    created_by: { ar: 'أنشئ بواسطة', en: 'Created by' },
  },
}

export const WAREHOUSE_KIND_LABELS: Record<WarehouseKind, Label> = {
  raw_store: { ar: 'مخزن خامات', en: 'Raw store' },
  factory_custody: { ar: 'عهدة المصنع', en: 'Factory custody' },
  main: { ar: 'مخزن رئيسي', en: 'Main' },
  sub: { ar: 'مخزن فرعي', en: 'Sub' },
  rep_custody: { ar: 'عهدة مندوب', en: 'Rep custody' },
}

export const CUSTOMER_APPROVAL_STATE_LABELS: Record<CustomerApprovalState, Label> = {
  approved: { ar: 'معتمد', en: 'Approved' },
  pending_approval: { ar: 'بانتظار الاعتماد', en: 'Pending approval' },
}

/** Convenience: `"عربي / English"`. */
export function bilingual(label: Label): string {
  return `${label.ar} / ${label.en}`
}
