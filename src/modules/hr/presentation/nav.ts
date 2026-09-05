/**
 * Nav metadata for the `hr` module. Dependency-light (no react / appwrite /
 * pages) so the app shell can import it without pulling the module into the
 * main bundle — the `/hr/*` route chunks stay code-split.
 *
 * Role choices:
 *  - Attendance is the broadest section — branch accountants run the daily
 *    sheet for their own branch, in addition to the System Admin.
 *  - Incentive rules are System-Admin-only in the UI (`master(...)` table,
 *    System-Admin-write per `scripts/appwrite/schema.ts`).
 *  - Payroll is gated to the same roles allowed to submit `payroll_runs`
 *    (`src/core/access.ts::SUBMIT_ROLE_BY_TABLE['payroll_runs']` — Chief
 *    Accountant + System Admin) since only they can carry a run to
 *    completion; showing it more broadly would just be a dead end.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

const ATTENDANCE_ROLES = [Role.BranchAccountant, Role.SystemAdmin] as const
const PAYROLL_ROLES = [Role.ChiefAccountant, Role.SystemAdmin] as const
const INCENTIVE_ROLES = [Role.SystemAdmin] as const
const HR_HUB_ROLES = [Role.BranchAccountant, Role.ChiefAccountant, Role.SystemAdmin] as const

export const hrNavItems: readonly NavItem[] = [
  { to: '/hr', label: 'الموارد البشرية', labelEn: 'HR', roles: HR_HUB_ROLES, end: true },
  { to: '/hr/attendance', label: 'الحضور', labelEn: 'Attendance', roles: ATTENDANCE_ROLES },
  {
    to: '/hr/incentive-rules',
    label: 'قواعد الحوافز',
    labelEn: 'Incentive rules',
    roles: INCENTIVE_ROLES,
  },
  { to: '/hr/payroll', label: 'الرواتب', labelEn: 'Payroll', roles: PAYROLL_ROLES },
]
