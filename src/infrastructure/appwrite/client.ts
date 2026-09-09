/**
 * The single shared Supabase browser client for Shield Pro.
 *
 * (This folder is still named `appwrite/` for now to keep import paths stable
 * during the Appwrite → Supabase migration; it will be renamed in cleanup.)
 *
 * URL + publishable key come from validated env config (`shared/config.ts`) —
 * never inlined. All data-layer code imports service instances from this
 * folder; nothing constructs its own client.
 */
import { createClient } from '@supabase/supabase-js'

import { config } from '@/shared/config'

export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // storageKey left at the supabase-js default so existing staff sessions
    // survive this change; only the portal client below takes an explicit key.
  },
})

/** Legacy alias — some modules import `{ client }`. */
export const client = supabase

/**
 * A SECOND, fully independent client for the CRM client portal.
 *
 * Staff and customers are different principals, but a browser holds one
 * Supabase session per `storageKey`. Without a separate key a customer signing
 * in at `/portal/login` would overwrite the staff member's token in the same
 * browser (and either `signOut()` would kill both). This client keeps the
 * portal session under its own `storageKey`, so the two coexist and are
 * revoked independently. Only `src/modules/crm/portal` and
 * `infrastructure/appwrite/portal.ts` may use it.
 */
export const portalSupabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'shieldpro-portal-auth',
  },
})
