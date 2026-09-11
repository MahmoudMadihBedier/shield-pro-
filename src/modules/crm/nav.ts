/**
 * Nav metadata for the CRM leads pipeline (the staff-facing surface — the
 * customer-detail panels have no nav entry of their own, and the client
 * portal is a separate top-level branch, see `portal/routes.tsx`).
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
    to: '/crm/leads',
    label: 'العملاء المحتملون',
    labelEn: 'Leads',
    roles: CRM_ROLES,
    end: true,
  },
]
