/**
 * Which roles may act on sales documents (submit / cancel / approve / post /
 * confirm a close-out). A UX affordance only — real enforcement is server-side
 * in `shield-server` + collection permissions (`claude.md` A.6).
 *
 * `domain` is pure TypeScript — `@/core` (framework-free) is allowed.
 */
import { Role, hasRole, type Principal } from '@/core/rbac'

/** Roles that see and operate the sales section. */
export const SALES_ACTOR_ROLES = [
  Role.SalesRep,
  Role.BranchAccountant,
  Role.ChiefAccountant,
  Role.SystemAdmin,
] as const

/** Roles that may approve a rep stock issue or confirm a rep close-out. */
export const SALES_MANAGER_ROLES = [
  Role.BranchAccountant,
  Role.ChiefAccountant,
  Role.SystemAdmin,
] as const

export function canActOnSales(principal: Principal | null | undefined): boolean {
  if (!principal) return false
  return SALES_ACTOR_ROLES.some((role) => hasRole(principal, role))
}

/** Approve/reject a rep issue, or confirm a close-out — the "account manager" gate. */
export function canManageSales(principal: Principal | null | undefined): boolean {
  if (!principal) return false
  return SALES_MANAGER_ROLES.some((role) => hasRole(principal, role))
}
