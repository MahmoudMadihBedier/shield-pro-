/**
 * Auth data layer — the only place the app talks to Appwrite `account` / `teams`.
 * Every function returns a `Result`; raw `AppwriteException`s never escape.
 */
import { buildPrincipal } from '@/core/principal'
import type { Principal } from '@/core/rbac'
import { err, ok, type Result } from '@/core/result'

import { mapAppwriteError } from './errors'
import { account, teams } from './services'

interface BranchPref {
  branchId?: string
}

/** Load the current session's principal, or `null` if nobody is signed in. */
export async function loadPrincipal(): Promise<Result<Principal | null>> {
  try {
    const user = await account.get()
    const [teamList, prefs] = await Promise.all([teams.list(), account.getPrefs<BranchPref>()])
    return ok(
      buildPrincipal({
        userId: user.$id,
        teamIds: teamList.teams.map((t) => t.$id),
        branchId: prefs.branchId ?? null,
      }),
    )
  } catch (e) {
    const mapped = mapAppwriteError(e)
    if (mapped.code === 'unauthorized') return ok(null)
    return err(mapped)
  }
}

export async function login(email: string, password: string): Promise<Result<Principal>> {
  try {
    await account.createEmailPasswordSession({ email, password })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
  const principal = await loadPrincipal()
  if (!principal.ok) return principal
  if (principal.value === null) {
    return err(mapAppwriteError(Object.assign(new Error('no session after login'), { code: 401 })))
  }
  return ok(principal.value)
}

export async function logout(): Promise<Result<null>> {
  try {
    await account.deleteSession({ sessionId: 'current' })
    return ok(null)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
