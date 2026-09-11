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
  statement: () => ['portal', 'statement'] as const,
} as const

export const crmAdminKeys = {
  root: () => ['crm-admin'] as const,
  portalAccount: (customerId: string) => ['crm-admin', 'portal-account', customerId] as const,
  activities: (customerId: string) => ['crm-admin', 'activities', customerId] as const,
  followups: (customerId: string) => ['crm-admin', 'followups', customerId] as const,
  staffOptions: () => ['crm-admin', 'staff-options'] as const,
} as const

export const crmLeadsKeys = {
  root: () => ['crm-leads'] as const,
  list: () => ['crm-leads', 'list'] as const,
  detail: (id: string) => ['crm-leads', 'detail', id] as const,
  events: (id: string) => ['crm-leads', 'events', id] as const,
} as const

export const crmHubKeys = {
  root: () => ['crm-hub'] as const,
  myFollowups: (userId: string) => ['crm-hub', 'my-followups', userId] as const,
} as const

/** Shared across every CRM surface — see `useCustomerDirectory`. */
export const crmDirectoryKeys = {
  customers: () => ['crm-directory', 'customers'] as const,
} as const
