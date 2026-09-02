/**
 * Which roles may act on purchasing documents (submit / cancel / post). A UX
 * affordance only — the real gate is server-side in `shield-server` +
 * collection permissions (`claude.md` A.6).
 *
 * `domain` is pure TypeScript — `@/core` (framework-free) is allowed.
 */
import { Role, hasRole, type Principal } from '@/core/rbac'

export const PURCHASING_ACTOR_ROLES = [
  Role.PurchasingAccountant,
  Role.RawStoreKeeper,
  Role.SystemAdmin,
] as const

export function canActOnPurchasing(principal: Principal | null | undefined): boolean {
  if (!principal) return false
  return PURCHASING_ACTOR_ROLES.some((role) => hasRole(principal, role))
}
