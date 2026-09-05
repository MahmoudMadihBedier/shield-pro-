/**
 * Public surface of the `admin` module (Wave 2a — master data).
 *
 * Domain schemas + types here are the source of truth every other business
 * module imports for these entities (`claude.md` B.2).
 */
// --- pages ----------------------------------------------------------------
export { AdminHomePage } from './presentation/pages/AdminHomePage'
export {
  BranchesListPage,
  WarehousesListPage,
  SuppliersListPage,
  RawMaterialsListPage,
} from './presentation/pages/list-pages'
export { UsersListPage } from './presentation/pages/UsersListPage'
export { ProductsListPage } from './presentation/pages/ProductsListPage'
export { ProductDetailPage } from './presentation/pages/ProductDetailPage'
export { CustomersListPage } from './presentation/pages/CustomersListPage'
export { CustomerDetailPage } from './presentation/pages/CustomerDetailPage'

// --- domain (imported by other modules) ---------------------------------
export * from './domain/schemas'
export { explodeBom } from './domain/bom'
export type { BomLineLike, RawMaterialDemand } from './domain/bom'
export {
  ENTITY_LABELS,
  FIELD_LABELS,
  WAREHOUSE_KIND_LABELS,
  CUSTOMER_APPROVAL_STATE_LABELS,
  bilingual,
} from './domain/labels'
export type { AdminEntity, Label } from './domain/labels'

// --- data (repositories) ----------------------------------------------------
export {
  branchesRepo,
  warehousesRepo,
  productsRepo,
  customersRepo,
  suppliersRepo,
  rawMaterialsRepo,
  productBomRepo,
} from './data/repos'
export { usersRepo } from './data/users-repo'
export type {
  ListParams,
  ListFilter,
  ListSort,
  ListPage,
  MasterRepo,
} from './data/master-repo'

// --- nav ------------------------------------------------------------------
// Re-exported from the dependency-light `./nav` so the app shell can pull nav
// metadata without dragging the module's pages into the main bundle.
export {
  adminNavItems,
  ADMIN_ENTITY_SLUG,
  ADMIN_LIST_ENTITIES,
  type AdminListEntity,
} from './nav'
