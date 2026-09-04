/**
 * Local TanStack Query key factory for the `returns` module. Kept module-local
 * (the shared `src/application/query/keys.ts` is not edited) — the shared
 * document hooks still use `queryKeys.documents.*` for the return-request doc
 * type itself; these keys cover the option-list reads.
 */
export const returnsKeys = {
  root: ['returns'] as const,

  options: {
    warehouses: () => ['returns', 'options', 'warehouses'] as const,
    products: () => ['returns', 'options', 'products'] as const,
  },
} as const
