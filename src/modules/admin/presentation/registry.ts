/**
 * One declarative config per master-data entity — list columns, form fields,
 * the repository, the input schema and the create-form defaults. The generic
 * list page, form panel and hooks all read from here so per-entity code stays a
 * thin wrapper (`claude.md` — keep per-entity code DRY).
 *
 * This is presentation-layer metadata (it names widgets and formats), so it
 * lives here and not in `domain/`.
 */
import type { ZodType } from 'zod'

import type { Result } from '@/core/result'

import {
  branchesRepo,
  customersRepo,
  productBomRepo,
  productsRepo,
  rawMaterialsRepo,
  suppliersRepo,
  warehousesRepo,
} from '../data/repos'
import type { ListSort, MasterRepo } from '../data/master-repo'
import { usersRepo } from '../data/users-repo'
import {
  CUSTOMER_APPROVAL_STATE_LABELS,
  WAREHOUSE_KIND_LABELS,
  type AdminEntity,
} from '../domain/labels'
import {
  branchInputSchema,
  customerInputSchema,
  productBomLineInputSchema,
  productInputSchema,
  rawMaterialInputSchema,
  supplierInputSchema,
  userInputSchema,
  warehouseInputSchema,
  WAREHOUSE_KINDS,
  type Branch,
  type BranchInput,
  type Customer,
  type CustomerInput,
  type Product,
  type ProductBomLine,
  type ProductBomLineInput,
  type ProductInput,
  type RawMaterial,
  type RawMaterialInput,
  type Supplier,
  type SupplierInput,
  type User,
  type UserInput,
  type Warehouse,
  type WarehouseInput,
} from '../domain/schemas'

export type { AdminEntity }

/** Row type returned by `list`/`get` for a given entity key. */
export interface AdminRowMap {
  branch: Branch
  warehouse: Warehouse
  user: User
  product: Product
  productBom: ProductBomLine
  rawMaterial: RawMaterial
  supplier: Supplier
  customer: Customer
}

/** Form input type for a given entity key. */
export interface AdminInputMap {
  branch: BranchInput
  warehouse: WarehouseInput
  user: UserInput
  product: ProductInput
  productBom: ProductBomLineInput
  rawMaterial: RawMaterialInput
  supplier: SupplierInput
  customer: CustomerInput
}

// ---------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------

export type CellFormat =
  | 'text'
  | 'number'
  | 'currency'
  | 'bool'
  | 'warehouseKind'
  | 'approvalState'

export interface ColumnDescriptor {
  field: string
  sortable?: boolean
  format?: CellFormat
  align?: 'start' | 'end' | 'center'
}

export type FieldKind = 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'relation'

export interface FieldDescriptor {
  name: string
  kind: FieldKind
  required?: boolean
  min?: number
  max?: number
  step?: number
  placeholder?: string
  /** For `kind: 'select'` — a fixed option list. */
  options?: ReadonlyArray<{ value: string; label: string }>
  /** For `kind: 'relation'` — load options from another entity. */
  relationTo?: 'branch' | 'supplier' | 'rawMaterial'
}

export interface EntityConfig<K extends AdminEntity> {
  key: K
  repo: MasterRepo<AdminRowMap[K], AdminInputMap[K]> & {
    remove?: (id: string) => Promise<Result<void>>
  }
  inputSchema: ZodType<AdminInputMap[K], AdminInputMap[K]>
  columns: ColumnDescriptor[]
  fields: FieldDescriptor[]
  defaultSort: ListSort
  /** RHF `defaultValues` for the create form. */
  emptyInput: AdminInputMap[K]
  canRemove: boolean
  searchPlaceholder: string
}

function define<K extends AdminEntity>(config: EntityConfig<K>): EntityConfig<K> {
  return config
}

const warehouseKindOptions = WAREHOUSE_KINDS.map((k) => ({
  value: k,
  label: `${WAREHOUSE_KIND_LABELS[k].ar} / ${WAREHOUSE_KIND_LABELS[k].en}`,
}))

const approvalStateOptions = (
  Object.keys(CUSTOMER_APPROVAL_STATE_LABELS) as Array<keyof typeof CUSTOMER_APPROVAL_STATE_LABELS>
).map((s) => ({
  value: s,
  label: `${CUSTOMER_APPROVAL_STATE_LABELS[s].ar} / ${CUSTOMER_APPROVAL_STATE_LABELS[s].en}`,
}))
void approvalStateOptions // approval_state is not an editable field; kept for reference

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const ADMIN_REGISTRY: { [K in AdminEntity]: EntityConfig<K> } = {
  branch: define({
    key: 'branch',
    repo: branchesRepo,
    inputSchema: branchInputSchema,
    defaultSort: { field: 'name', dir: 'asc' },
    canRemove: false,
    searchPlaceholder: 'ابحث بالاسم…',
    columns: [
      { field: 'name', sortable: true },
      { field: 'name_ar' },
      { field: 'location' },
      { field: 'is_active', format: 'bool', align: 'center' },
    ],
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'name_ar', kind: 'text' },
      { name: 'location', kind: 'text' },
      { name: 'sub_warehouse_id', kind: 'text' },
      { name: 'branch_accountant_id', kind: 'text' },
      { name: 'is_active', kind: 'checkbox' },
    ],
    emptyInput: {
      name: '',
      name_ar: '',
      location: '',
      sub_warehouse_id: '',
      branch_accountant_id: '',
      is_active: true,
    },
  }),

  warehouse: define({
    key: 'warehouse',
    repo: warehousesRepo,
    inputSchema: warehouseInputSchema,
    defaultSort: { field: 'name', dir: 'asc' },
    canRemove: false,
    searchPlaceholder: 'ابحث بالاسم…',
    columns: [
      { field: 'name', sortable: true },
      { field: 'kind', format: 'warehouseKind' },
      { field: 'branch_id' },
      { field: 'is_active', format: 'bool', align: 'center' },
    ],
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'kind', kind: 'select', required: true, options: warehouseKindOptions },
      { name: 'branch_id', kind: 'relation', relationTo: 'branch' },
      { name: 'owner_user_id', kind: 'text' },
      { name: 'is_active', kind: 'checkbox' },
    ],
    emptyInput: { name: '', kind: 'main', branch_id: '', owner_user_id: '', is_active: true },
  }),

  user: define({
    key: 'user',
    repo: usersRepo,
    inputSchema: userInputSchema,
    defaultSort: { field: 'full_name', dir: 'asc' },
    canRemove: false,
    searchPlaceholder: 'ابحث بالاسم…',
    columns: [
      { field: 'full_name', sortable: true },
      { field: 'roles' },
      { field: 'branch_id' },
      { field: 'job_grade' },
      { field: 'is_active', format: 'bool', align: 'center' },
    ],
    fields: [
      { name: 'auth_user_id', kind: 'text', required: true },
      { name: 'full_name', kind: 'text', required: true },
      { name: 'roles', kind: 'text', placeholder: 'sales_rep' },
      { name: 'sub_warehouse_id', kind: 'text' },
      { name: 'job_grade', kind: 'text' },
      { name: 'is_active', kind: 'checkbox' },
    ],
    emptyInput: {
      auth_user_id: '',
      full_name: '',
      roles: '',
      sub_warehouse_id: '',
      job_grade: '',
      is_active: true,
    },
  }),

  product: define({
    key: 'product',
    repo: productsRepo,
    inputSchema: productInputSchema,
    defaultSort: { field: 'name', dir: 'asc' },
    canRemove: false,
    searchPlaceholder: 'ابحث بالاسم…',
    columns: [
      { field: 'code', sortable: true },
      { field: 'name', sortable: true },
      { field: 'uom' },
      { field: 'base_price', format: 'currency', align: 'end' },
      { field: 'default_discount_pct', format: 'number', align: 'end' },
      { field: 'is_active', format: 'bool', align: 'center' },
    ],
    fields: [
      { name: 'code', kind: 'text', required: true },
      { name: 'name', kind: 'text', required: true },
      { name: 'name_ar', kind: 'text' },
      { name: 'uom', kind: 'text', required: true, placeholder: 'pc / kg / L' },
      { name: 'base_price', kind: 'number', required: true, min: 0 },
      { name: 'default_discount_pct', kind: 'number', min: 0, max: 100 },
      { name: 'allowed_waste_pct', kind: 'number', min: 0, max: 100 },
      { name: 'is_active', kind: 'checkbox' },
    ],
    emptyInput: {
      code: '',
      name: '',
      name_ar: '',
      uom: '',
      base_price: 0,
      default_discount_pct: 0,
      allowed_waste_pct: 0,
      is_active: true,
    },
  }),

  productBom: define({
    key: 'productBom',
    repo: productBomRepo,
    inputSchema: productBomLineInputSchema,
    defaultSort: { field: 'raw_material_id', dir: 'asc' },
    canRemove: true,
    searchPlaceholder: '',
    columns: [
      { field: 'raw_material_id' },
      { field: 'qty_per_unit', format: 'number', align: 'end' },
    ],
    fields: [
      { name: 'raw_material_id', kind: 'relation', relationTo: 'rawMaterial', required: true },
      { name: 'qty_per_unit', kind: 'number', required: true, min: 0 },
    ],
    emptyInput: { product_id: '', raw_material_id: '', qty_per_unit: 0 },
  }),

  rawMaterial: define({
    key: 'rawMaterial',
    repo: rawMaterialsRepo,
    inputSchema: rawMaterialInputSchema,
    defaultSort: { field: 'name', dir: 'asc' },
    canRemove: true,
    searchPlaceholder: 'ابحث بالاسم…',
    columns: [
      { field: 'code', sortable: true },
      { field: 'name', sortable: true },
      { field: 'uom' },
      { field: 'purchase_price', format: 'currency', align: 'end' },
      { field: 'reorder_point', format: 'number', align: 'end' },
    ],
    fields: [
      { name: 'code', kind: 'text', required: true },
      { name: 'name', kind: 'text', required: true },
      { name: 'uom', kind: 'text', required: true, placeholder: 'kg / L' },
      { name: 'purchase_price', kind: 'number', min: 0 },
      { name: 'preferred_supplier_id', kind: 'relation', relationTo: 'supplier' },
      { name: 'reorder_point', kind: 'number', min: 0 },
    ],
    emptyInput: {
      code: '',
      name: '',
      uom: '',
      purchase_price: 0,
      preferred_supplier_id: '',
      reorder_point: 0,
    },
  }),

  supplier: define({
    key: 'supplier',
    repo: suppliersRepo,
    inputSchema: supplierInputSchema,
    defaultSort: { field: 'name', dir: 'asc' },
    canRemove: true,
    searchPlaceholder: 'ابحث بالاسم…',
    columns: [
      { field: 'name', sortable: true },
      { field: 'contact' },
      { field: 'phone' },
    ],
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'contact', kind: 'text' },
      { name: 'phone', kind: 'text' },
    ],
    emptyInput: { name: '', contact: '', phone: '' },
  }),

  customer: define({
    key: 'customer',
    repo: customersRepo,
    inputSchema: customerInputSchema,
    defaultSort: { field: 'name', dir: 'asc' },
    canRemove: false,
    searchPlaceholder: 'ابحث بالاسم…',
    columns: [
      { field: 'code', sortable: true },
      { field: 'name', sortable: true },
      { field: 'phone' },
      { field: 'branch_id' },
      { field: 'discount_pct', format: 'number', align: 'end' },
      { field: 'credit_limit', format: 'currency', align: 'end' },
      { field: 'approval_state', format: 'approvalState', align: 'center' },
    ],
    fields: [
      { name: 'code', kind: 'text', required: true },
      { name: 'name', kind: 'text', required: true },
      { name: 'phone', kind: 'text' },
      { name: 'branch_id', kind: 'relation', relationTo: 'branch', required: true },
      { name: 'geo', kind: 'text', required: true, placeholder: '30.0444,31.2357' },
      { name: 'discount_pct', kind: 'number', min: 0, max: 100 },
      { name: 'credit_limit', kind: 'number', min: 0 },
      { name: 'payment_terms_days', kind: 'number', min: 0, step: 1 },
    ],
    emptyInput: {
      code: '',
      name: '',
      phone: '',
      branch_id: '',
      geo: '',
      discount_pct: 0,
      credit_limit: 0,
      payment_terms_days: 0,
    },
  }),
}

export type AdminRegistry = typeof ADMIN_REGISTRY

export {
  ADMIN_LIST_ENTITIES,
  ADMIN_ENTITY_SLUG,
  type AdminListEntity,
} from '../nav'
