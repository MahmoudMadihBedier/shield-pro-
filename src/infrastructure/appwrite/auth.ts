/**
 * Staff auth data layer — the only place the app talks to `supabase.auth` for
 * employee sign-in. Every function returns a `Result`; raw Supabase errors
 * never escape.
 *
 * Identity facts:
 *   - `supabase.auth` owns the session (email + password).
 *   - `public.users` holds the profile: `roles` (space/comma-separated role
 *     slugs) and `branch_id` (set exclusively by the System Admin). It is keyed
 *     by `auth_user_id = auth.uid()::text` and readable via the `users_read_self`
 *     RLS policy.
 */
import { buildPrincipal } from '@/core/principal'
import type { Principal } from '@/core/rbac'
import { err, ok, type Result } from '@/core/result'

import { supabase } from './client'
import { mapAppwriteError } from './errors'

interface UserProfileRow {
  roles: string | null
  branch_id: string | null
}

function splitRoles(raw: string | null): string[] {
  return (raw ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Load the current session's principal, or `null` if nobody is signed in. */
export async function loadPrincipal(): Promise<Result<Principal | null>> {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) {
      const mapped = mapAppwriteError(userError)
      return mapped.code === 'unauthorized' ? ok(null) : err(mapped)
    }
    const authUser = userData.user
    if (!authUser) return ok(null)

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('roles, branch_id')
      .eq('auth_user_id', authUser.id)
      .maybeSingle<UserProfileRow>()
    if (profileError) return err(mapAppwriteError(profileError))

    return ok(
      buildPrincipal({
        userId: authUser.id,
        teamIds: splitRoles(profile?.roles ?? null),
        branchId: profile?.branch_id ?? null,
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return err(mapAppwriteError(error))
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
    const { error } = await supabase.auth.signOut()
    if (error) return err(mapAppwriteError(error))
    return ok(null)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
