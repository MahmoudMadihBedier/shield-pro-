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
  },
})

/** Legacy alias — some modules import `{ client }`. */
export const client = supabase
