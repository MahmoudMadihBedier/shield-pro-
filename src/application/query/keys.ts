/** Central TanStack Query key factory — keeps invalidation predictable. */

export const queryKeys = {
  health: {
    appwrite: () => ['health', 'appwrite'] as const,
  },
  auth: {
    session: () => ['auth', 'session'] as const,
  },
  traceability: {
    root: () => ['traceability'] as const,
    chain: (rootRefId: string) => ['traceability', 'chain', rootRefId] as const,
    node: (refId: string) => ['traceability', 'node', refId] as const,
  },
  audit: {
    root: () => ['audit'] as const,
    trail: (filters: { entityRef?: string; actorId?: string } = {}) =>
      ['audit', 'trail', filters.entityRef ?? null, filters.actorId ?? null] as const,
  },
  admin: {
    root: () => ['admin'] as const,
    list: (entity: string, params: unknown) => ['admin', 'list', entity, params] as const,
    detail: (entity: string, id: string) => ['admin', 'detail', entity, id] as const,
    counts: () => ['admin', 'counts'] as const,
  },
} as const
