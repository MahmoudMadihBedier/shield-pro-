/**
 * Per-entity master-data repositories, built from the generic factory.
 *
 * `remove` is exposed ONLY for `suppliers`, `raw_materials` and `product_bom`
 * (no downstream ledger / document references). Branches, warehouses, users,
 * products and customers are deactivated via `is_active`, never hard-deleted.
 */
import type { Result } from '@/core/result'
import { Tables } from '@/infrastructure/appwrite/collections'

import {
  DEFAULT_CUSTOMER_APPROVAL_STATE,
  branchInputSchema,
  branchRowSchema,
  customerInputSchema,
  customerRowSchema,
  productBomLineInputSchema,
  productBomLineRowSchema,
  productInputSchema,
  productRowSchema,
  rawMaterialInputSchema,
  rawMaterialRowSchema,
  supplierInputSchema,
  supplierRowSchema,
  warehouseInputSchema,
  warehouseRowSchema,
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
  type Warehouse,
  type WarehouseInput,
} from '../domain/schemas'
import { makeMasterRepo, makeRemove, type ListParams, type MasterRepo } from './master-repo'

export const branchesRepo: MasterRepo<Branch, BranchInput> = makeMasterRepo({
  tableId: Tables.branches,
  rowSchema: branchRowSchema,
  inputSchema: branchInputSchema,
  searchField: 'name',
})

export const warehousesRepo: MasterRepo<Warehouse, WarehouseInput> = makeMasterRepo({
  tableId: Tables.warehouses,
  rowSchema: warehouseRowSchema,
  inputSchema: warehouseInputSchema,
  searchField: 'name',
})

export const productsRepo: MasterRepo<Product, ProductInput> = makeMasterRepo({
  tableId: Tables.products,
  rowSchema: productRowSchema,
  inputSchema: productInputSchema,
  searchField: 'name',
})

export const customersRepo: MasterRepo<Customer, CustomerInput> = makeMasterRepo({
  tableId: Tables.customers,
  rowSchema: customerRowSchema,
  inputSchema: customerInputSchema,
  searchField: 'name',
  // approval_state is workflow-owned; every new customer starts pending.
  createDefaults: { approval_state: DEFAULT_CUSTOMER_APPROVAL_STATE },
})

// --- entities that also support hard delete ---------------------------------

export const suppliersRepo: MasterRepo<Supplier, SupplierInput> & {
  remove: (id: string) => Promise<Result<void>>
} = {
  ...makeMasterRepo({
    tableId: Tables.suppliers,
    rowSchema: supplierRowSchema,
    inputSchema: supplierInputSchema,
    searchField: 'name',
  }),
  remove: makeRemove(Tables.suppliers),
}

export const rawMaterialsRepo: MasterRepo<RawMaterial, RawMaterialInput> & {
  remove: (id: string) => Promise<Result<void>>
} = {
  ...makeMasterRepo({
    tableId: Tables.rawMaterials,
    rowSchema: rawMaterialRowSchema,
    inputSchema: rawMaterialInputSchema,
    searchField: 'name',
  }),
  remove: makeRemove(Tables.rawMaterials),
}

export const productBomRepo: MasterRepo<ProductBomLine, ProductBomLineInput> & {
  remove: (id: string) => Promise<Result<void>>
  listForProduct: (productId: string) => Promise<Result<{ rows: ProductBomLine[]; total: number }>>
} = (() => {
  const base = makeMasterRepo({
    tableId: Tables.productBom,
    rowSchema: productBomLineRowSchema,
    inputSchema: productBomLineInputSchema,
    searchField: 'product_id',
  })
  return {
    ...base,
    remove: makeRemove(Tables.productBom),
    /** All BOM lines for one product (used by the product detail screen). */
    listForProduct: (productId: string) =>
      base.list({
        page: 0,
        pageSize: 100,
        sort: null,
        filters: [{ field: 'product_id', value: productId }],
      }),
  }
})()

export type { ListParams }
