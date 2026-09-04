/**
 * Local TanStack Query key factory for the `purchasing` module. Kept module-
 * local (not in `src/application/query/keys.ts`) so the module owns its own
 * cache namespace and invalidation.
 */
export const purchasingKeys = {
  all: ['purchasing'] as const,

  poList: (params: unknown) => ['purchasing', 'po', 'list', params] as const,
  poDetail: (id: string) => ['purchasing', 'po', 'detail', id] as const,

  receiptList: (params: unknown) => ['purchasing', 'receipt', 'list', params] as const,
  receiptDetail: (id: string) => ['purchasing', 'receipt', 'detail', id] as const,

  supplierOptions: () => ['purchasing', 'supplier-options'] as const,
  rawMaterialOptions: () => ['purchasing', 'raw-material-options'] as const,
  rawStoreWarehouseOptions: () => ['purchasing', 'raw-store-warehouse-options'] as const,
  submittedPoOptions: () => ['purchasing', 'submitted-po-options'] as const,
}
