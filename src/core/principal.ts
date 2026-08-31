/**
 * Builds a `Principal` (see `rbac.ts`) from raw identity facts pulled out of
 * Appwrite — team memberships and account preferences. Pure mapping, no SDK
 * imports, independently testable.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */
import { Role, type Principal } from './rbac'

const KNOWN_ROLE_IDS: ReadonlySet<string> = new Set<string>(Object.values(Role))

/** Keep only the team ids that correspond to a real Shield Pro role. */
export function rolesFromTeamIds(teamIds: readonly string[]): Role[] {
  const seen = new Set<Role>()
  for (const id of teamIds) {
    if (KNOWN_ROLE_IDS.has(id)) seen.add(id as Role)
  }
  return [...seen]
}

export interface RawIdentity {
  userId: string
  /** `$id` of every team the user belongs to (team id === role slug). */
  teamIds: readonly string[]
  /** `branchId` account preference — set exclusively by the System Admin. */
  branchId?: string | null
}

export function buildPrincipal(raw: RawIdentity): Principal {
  return {
    userId: raw.userId,
    roles: rolesFromTeamIds(raw.teamIds),
    branchId: raw.branchId ?? null,
  }
}
