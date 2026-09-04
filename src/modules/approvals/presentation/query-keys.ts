/**
 * Local TanStack Query key factory for the `approvals` module (the shared
 * `src/application/query/keys.ts` is not edited — coordinator territory).
 */
export const approvalsKeys = {
  root: ['approvals'] as const,

  rules: {
    root: ['approvals', 'rules'] as const,
    list: (params: unknown) => ['approvals', 'rules', 'list', params] as const,
  },

  requests: {
    root: ['approvals', 'requests'] as const,
    list: (params: unknown) => ['approvals', 'requests', 'list', params] as const,
    pending: (params: unknown) => ['approvals', 'requests', 'pending', params] as const,
  },

  ruleLog: {
    root: ['approvals', 'rule-log'] as const,
    list: (params: unknown) => ['approvals', 'rule-log', 'list', params] as const,
  },
} as const
