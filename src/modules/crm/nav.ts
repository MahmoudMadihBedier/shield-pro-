/**
 * Nav metadata for the CRM staff surface — the hub (`/crm`) and the leads
 * pipeline (`/crm/leads`). The customer-detail panels (activity log,
 * follow-ups) have no nav entry of their own; the client portal is a
 * separate top-level branch, see `portal/routes.tsx`.
 * Dependency-light (no react / data layer) so the app shell can import it
 * without pulling the module into the main bundle.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

const CRM_ROLES = [
  Role.SalesRep,
  Role.BranchAccountant,
  Role.ChiefAccountant,
  Role.SystemAdmin,
] as const

export const crmNavItems: readonly NavItem[] = [
  {
    to: '/crm',
    label: 'CRM',
    labelEn: 'CRM',
    roles: CRM_ROLES,
    end: true,
  },
  {
    to: '/crm/leads',
    label: 'العملاء المحتملون',
    labelEn: 'Leads',
    roles: CRM_ROLES,
  },
]
