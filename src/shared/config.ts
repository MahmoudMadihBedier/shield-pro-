/**
 * The single place env config is read and validated. Import `config` from here;
 * never touch `import.meta.env` anywhere else.
 *
 * Backend: Supabase (Postgres + Auth + RLS + RPC + Realtime + Storage). The
 * URL + publishable key are NON-SECRET client config that ships in the browser
 * bundle by design; they live in the committed `.env`. Real secrets (the
 * service-role key, DB password) are server-only and never referenced here.
 */
import { z } from 'zod'

const envSchema = z.object({
  supabaseUrl: z.string().url(),
  supabasePublishableKey: z.string().min(1),
})

const parsed = envSchema.safeParse({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
})

if (!parsed.success) {
  // Fail loud and early: a misconfigured build should never reach a user.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n')
  throw new Error(`Invalid Supabase configuration. Check your .env file:\n${issues}`)
}

export const config = Object.freeze(parsed.data)

export type AppConfig = typeof config
