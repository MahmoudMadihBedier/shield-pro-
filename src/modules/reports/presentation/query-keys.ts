/**
 * Local TanStack Query key factory for the `reports` module. The shared
 * `src/application/query/keys.ts` is not edited — this module reads several
 * tables directly (not through `@/shared/documents`) so it keeps its own key
 * namespace.
 */
export const reportsKeys = {
  root: ['reports'] as const,
  dashboard: (params: unknown) => ['reports', 'dashboard', params] as const,
} as const
