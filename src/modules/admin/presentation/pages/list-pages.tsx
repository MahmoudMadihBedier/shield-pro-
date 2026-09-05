/**
 * Thin per-entity list pages. Each is just the generic `MasterListPage` bound to
 * one registry entity — the shared component owns the table, search, paging and
 * the create/edit dialog.
 */
import { MasterListPage } from '../components/MasterListPage'

export function BranchesListPage() {
  return <MasterListPage entity="branch" />
}

export function WarehousesListPage() {
  return <MasterListPage entity="warehouse" />
}

export function SuppliersListPage() {
  return <MasterListPage entity="supplier" />
}

export function RawMaterialsListPage() {
  return <MasterListPage entity="rawMaterial" />
}
