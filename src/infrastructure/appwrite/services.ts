/**
 * Backend service singletons, all bound to the one shared Supabase `client`.
 *
 * (Folder still named `appwrite/` during the migration — import paths stay
 * stable; it will be renamed in cleanup.)
 *
 * Data-layer repositories (`modules/<name>/data`) use these; presentation and
 * domain layers never do. `tablesDB` / `Query` / `ID` keep the Appwrite-shaped
 * surface via the shims in `./tables` and `./query` so the module data layers
 * did not have to change.
 */
import { supabase, client } from './client'
import { ID, Permission, Query, Role as AppwriteRole } from './query'
import { tablesDB } from './tables'

/**
 * Minimal `account` shim over `supabase.auth`, exposing only the methods the
 * app calls (staff auth lives in `./auth`; this covers the CRM client portal).
 */
export const account = {
  async get(): Promise<{ $id: string; email: string; name: string }> {
    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    const user = data.user
    if (!user) throw Object.assign(new Error('no active session'), { name: 'AuthSessionMissingError' })
    return {
      $id: user.id,
      email: user.email ?? '',
      name: (user.user_metadata?.name as string | undefined) ?? user.email ?? '',
    }
  },

  async getPrefs<T = Record<string, unknown>>(): Promise<T> {
    const { data } = await supabase.auth.getUser()
    return ((data.user?.user_metadata ?? {}) as T)
  },

  async createEmailPasswordSession(params: { email: string; password: string }): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    })
    if (error) throw error
  },

  async deleteSession(_params: { sessionId: string }): Promise<void> {
    void _params
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async updatePassword(params: { password: string; oldPassword?: string }): Promise<void> {
    // Supabase's updateUser does not verify the current password; re-authenticate
    // first so a stolen-but-unlocked session cannot silently change the PIN.
    if (params.oldPassword) {
      const { data } = await supabase.auth.getUser()
      const email = data.user?.email
      if (!email) {
        throw Object.assign(new Error('no active session'), { name: 'AuthSessionMissingError' })
      }
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: params.oldPassword,
      })
      if (reauthError) throw reauthError
    }
    const { error } = await supabase.auth.updateUser({ password: params.password })
    if (error) throw error
  },
}

/** Storage lives on `supabase.storage`; expose it directly for repos that need it. */
export const storage = supabase.storage

/** `functions` / `teams` / `avatars` have no direct callers post-migration
 *  (RPC wrappers live in `./functions`, roles come from `public.users`). Kept as
 *  guarded stubs so a stray import still resolves instead of crashing at load. */
const notImplemented = (name: string) => () => {
  throw new Error(`${name} is not available on the Supabase backend`)
}
export const functions = { createExecution: notImplemented('functions.createExecution') }
export const teams = { list: notImplemented('teams.list') }
export const avatars = { getInitials: notImplemented('avatars.getInitials') }

export { supabase, client, tablesDB, ID, Permission, Query, AppwriteRole }
