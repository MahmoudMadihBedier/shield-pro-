/**
 * Local TanStack Query key factory for the `fraud` module (kept module-local,
 * the shared `src/application/query/keys.ts` is not edited — see
 * `src/modules/inventory/presentation/query-keys.ts` for the same pattern).
 */
export const fraudKeys = {
  root: ['fraud'] as const,

  flags: {
    list: (params: unknown) => ['fraud', 'flags', 'list', params] as const,
    detail: (id: string) => ['fraud', 'flags', 'detail', id] as const,
  },
} as const
