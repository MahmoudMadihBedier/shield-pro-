/**
 * Local TanStack Query key factory for the `sales` module. Kept module-local
 * (the shared `src/application/query/keys.ts` is not edited) — the shared
 * document hooks still key the three submittable docs through
 * `queryKeys.documents.*`; these keys cover the option lists and the read-only
 * rep-ledger reads.
 */
export const salesKeys = {
  root: ['sales'] as const,

  options: {
    customers: (search: string | null) => ['sales', 'options', 'customers', search] as const,
    products: () => ['sales', 'options', 'products'] as const,
    reps: () => ['sales', 'options', 'reps'] as const,
    warehouses: (kind: string | null) => ['sales', 'options', 'warehouses', kind] as const,
  },

  repLedger: {
    stock: (params: unknown) => ['sales', 'rep-ledger', 'stock', params] as const,
    cash: (params: unknown) => ['sales', 'rep-ledger', 'cash', params] as const,
    stockBalance: (repUserId: string) =>
      ['sales', 'rep-ledger', 'stock-balance', repUserId] as const,
    cashBalance: (repUserId: string) => ['sales', 'rep-ledger', 'cash-balance', repUserId] as const,
  },
} as const
