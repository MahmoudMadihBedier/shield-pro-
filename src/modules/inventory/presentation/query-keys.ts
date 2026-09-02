/**
 * Local TanStack Query key factory for the `inventory` module. Kept module-local
 * (the shared `src/application/query/keys.ts` is not edited) — the shared
 * document hooks still use `queryKeys.documents.*` for the three doc types; these
 * keys cover the bin-balances reads and any inventory-specific derived queries.
 */
export const inventoryKeys = {
  root: ['inventory'] as const,

  bin: {
    root: ['inventory', 'bin'] as const,
    list: (params: unknown) => ['inventory', 'bin', 'list', params] as const,
    qty: (productId: string, warehouseId: string) =>
      ['inventory', 'bin', 'qty', productId, warehouseId] as const,
  },

  options: {
    warehouses: (kind: string | null) => ['inventory', 'options', 'warehouses', kind] as const,
    products: () => ['inventory', 'options', 'products'] as const,
  },

  transfer: {
    list: (params: unknown) => ['inventory', 'transfer', 'list', params] as const,
    detail: (id: string) => ['inventory', 'transfer', 'detail', id] as const,
  },
  count: {
    list: (params: unknown) => ['inventory', 'count', 'list', params] as const,
    detail: (id: string) => ['inventory', 'count', 'detail', id] as const,
  },
  writeoff: {
    list: (params: unknown) => ['inventory', 'writeoff', 'list', params] as const,
    detail: (id: string) => ['inventory', 'writeoff', 'detail', id] as const,
  },
} as const
