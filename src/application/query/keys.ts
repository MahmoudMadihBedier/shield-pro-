/** Central TanStack Query key factory — keeps invalidation predictable. */

export const queryKeys = {
  health: {
    appwrite: () => ['health', 'appwrite'] as const,
  },
} as const
