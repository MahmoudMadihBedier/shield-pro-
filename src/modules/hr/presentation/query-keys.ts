/**
 * Local TanStack Query key factory for the `hr` module. Kept module-local (the
 * shared `src/application/query/keys.ts` is not edited) — the shared document
 * hooks still use `queryKeys.documents.*` for `payroll_runs`; these keys cover
 * attendance, incentive rules and the employee-options read.
 */
export const hrKeys = {
  root: ['hr'] as const,

  attendance: {
    list: (params: unknown) => ['hr', 'attendance', 'list', params] as const,
  },

  incentiveRules: {
    list: (params: unknown) => ['hr', 'incentive-rules', 'list', params] as const,
  },

  employees: {
    options: (branchId: string | null) => ['hr', 'employees', 'options', branchId] as const,
  },
} as const
