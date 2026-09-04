/**
 * Local TanStack Query key factory for the `accounting` module. Kept module-
 * local (the shared `src/application/query/keys.ts` is not edited) — the shared
 * document hooks still use `queryKeys.documents.*` for `receipts` /
 * `payment_vouchers`; these keys cover the GL reads, the aging report and the
 * option lists.
 */
export const accountingKeys = {
  root: ['accounting'] as const,

  gl: {
    root: ['accounting', 'gl'] as const,
    list: (params: unknown) => ['accounting', 'gl', 'list', params] as const,
    balance: (account: string) => ['accounting', 'gl', 'balance', account] as const,
    trialBalance: (params: unknown) => ['accounting', 'gl', 'trial-balance', params] as const,
  },

  aging: {
    root: ['accounting', 'aging'] as const,
    report: (asOf: string) => ['accounting', 'aging', 'report', asOf] as const,
    customer: (customerId: string) => ['accounting', 'aging', 'customer', customerId] as const,
  },

  options: {
    customers: () => ['accounting', 'options', 'customers'] as const,
    submittedInvoices: () => ['accounting', 'options', 'submitted-invoices'] as const,
  },
} as const
