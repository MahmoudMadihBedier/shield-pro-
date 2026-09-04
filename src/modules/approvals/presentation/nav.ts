/**
 * Nav metadata for the `approvals` module. Dependency-light (no react / data
 * layer) so the app shell can import it without pulling the module into the
 * main bundle — the `/approvals/*` route chunks stay code-split.
 *
 * The exceptions dashboard is where a decision actually happens, so its role
 * gate is the accounting-adjacent set that can be entrusted with movement
 * sign-off. Rules management is additionally gated to the System Admin
 * in-page (`ApprovalRulesListPage`) — everyone in this list can still *view*
 * the rule set, since routing here doesn't distinguish read from write.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

export const APPROVALS_NAV_ROLES: readonly Role[] = [
  Role.SystemAdmin,
  Role.ChiefAccountant,
  Role.BranchAccountant,
]

export const approvalsNavItems: NavItem[] = [
  {
    to: '/approvals/exceptions',
    label: 'الموافقات',
    labelEn: 'Approvals',
    roles: APPROVALS_NAV_ROLES,
  },
  {
    to: '/approvals/rules',
    label: 'قواعد الموافقة',
    labelEn: 'Approval rules',
    roles: APPROVALS_NAV_ROLES,
  },
]
