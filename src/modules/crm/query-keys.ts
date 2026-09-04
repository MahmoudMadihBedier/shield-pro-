/**
 * Local TanStack Query key factories for the `crm` module. `@/application/
 * query/keys` is the staff key registry and is off-limits to this module
 * (claude.md constraint) — the portal and the admin-side panel each get their
 * own small factory here instead.
 */

export const portalKeys = {
  root: () => ['portal'] as const,
  session: () => ['portal', 'session'] as const,
  me: () => ['portal', 'me'] as const,
  invoices: (params: unknown) => ['portal', 'invoices', params] as const,
  invoice: (id: string) => ['portal', 'invoice', id] as const,
  receipts: (params: unknown) => ['portal', 'receipts', params] as const,
} as const

export const crmAdminKeys = {
  root: () => ['crm-admin'] as const,
  portalAccount: (customerId: string) => ['crm-admin', 'portal-account', customerId] as const,
} as const
