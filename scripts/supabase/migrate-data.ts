/**
 * One-time Appwrite → Supabase data migration for Shield Pro.
 *
 * The Appwrite project's API key is billing-locked, so the source rows were
 * captured via the Appwrite console and frozen into `appwrite-export.json`
 * (already in Supabase column shape). This script loads them into Supabase
 * with the service-role key (bypassing RLS) and, optionally, recreates the
 * staff auth accounts.
 *
 *   pnpm tsx scripts/supabase/migrate-data.ts                    # dry run
 *   pnpm tsx scripts/supabase/migrate-data.ts --commit           # upsert rows
 *   pnpm tsx scripts/supabase/migrate-data.ts --commit --accounts '<password>'
 *
 * With --accounts, every `users` row that carries a `_portal_email` gets a
 * Supabase auth user (that email, the given password, email pre-confirmed) and
 * its `public.users.auth_user_id` is rewritten to the new auth UUID. Re-runs
 * are idempotent: existing rows are upserted on `id`, existing auth users are
 * matched by email and reused.
 *
 * Env (from .env / .env.local): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')

// --- env ------------------------------------------------------------------
function readEnvFile(name: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(resolve(ROOT, name), 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=')
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
        }),
    )
  } catch {
    return {}
  }
}
const env = { ...readEnvFile('.env'), ...readEnvFile('.env.local'), ...process.env }
const SUPABASE_URL = env.VITE_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// --- args ------------------------------------------------------------------
const args = process.argv.slice(2)
const COMMIT = args.includes('--commit')
const accountsIdx = args.indexOf('--accounts')
const ACCOUNTS_PASSWORD = accountsIdx >= 0 ? args[accountsIdx + 1] : null
if (accountsIdx >= 0 && (!ACCOUNTS_PASSWORD || ACCOUNTS_PASSWORD.startsWith('--'))) {
  console.error('--accounts requires a password argument')
  process.exit(1)
}

// --- data ----------------------------------------------------------------
interface UserRow {
  id: string
  auth_user_id: string
  full_name: string
  roles: string
  _portal_email?: string
  [k: string]: unknown
}
type Export = Record<string, Array<Record<string, unknown>>> & { users: UserRow[] }

const data = JSON.parse(
  readFileSync(resolve(HERE, 'appwrite-export.json'), 'utf8'),
) as Export & { _comment?: string }
delete data._comment

/** Table load order — parents before children (FKs are soft, but keep it tidy). */
const TABLE_ORDER = [
  'branches',
  'warehouses',
  'suppliers',
  'raw_materials',
  'products',
  'product_bom',
  'customers',
  'users',
]

const sb: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findAuthUserByEmail(email: string): Promise<string | null> {
  // listUsers is paginated (50/page default); walk until found or exhausted.
  for (let page = 1; page <= 40; page++) {
    const { data: list, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = list.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase())
    if (hit) return hit.id
    if (list.users.length < 200) return null
  }
  return null
}

async function ensureAuthUser(email: string, name: string, password: string): Promise<string> {
  const existing = await findAuthUserByEmail(email)
  if (existing) {
    console.log(`   auth: ${email} already exists (${existing}) — reused`)
    return existing
  }
  const { data: created, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  })
  if (error || !created.user) throw error ?? new Error('createUser returned no user')
  console.log(`   auth: ${email} created (${created.user.id})`)
  return created.user.id
}

async function main() {
  console.log(`Shield Pro data migration → ${SUPABASE_URL}`)
  console.log(COMMIT ? '*** COMMIT mode ***' : '(dry run — pass --commit to write)')
  console.log(
    ACCOUNTS_PASSWORD ? '*** will (re)create staff auth accounts ***' : '(no --accounts: profiles keep their Appwrite auth_user_id)',
  )
  console.log()

  // 1. build the auth-id remap (Appwrite id -> new Supabase uuid)
  const authRemap = new Map<string, string>()
  if (ACCOUNTS_PASSWORD && COMMIT) {
    console.log('— staff auth accounts —')
    for (const u of data.users) {
      if (!u._portal_email) continue
      const newId = await ensureAuthUser(u._portal_email, u.full_name, ACCOUNTS_PASSWORD)
      authRemap.set(u.auth_user_id, newId)
    }
    console.log()
  } else if (ACCOUNTS_PASSWORD) {
    for (const u of data.users) {
      if (u._portal_email) console.log(`   would create auth user: ${u._portal_email} (${u.roles})`)
    }
    console.log()
  }

  // 2. upsert every table
  for (const table of TABLE_ORDER) {
    const rows = (data[table] ?? []).map((r) => {
      const copy: Record<string, unknown> = { ...r }
      delete copy._portal_email
      if (table === 'users' && authRemap.has(copy.auth_user_id as string)) {
        copy.auth_user_id = authRemap.get(copy.auth_user_id as string)
      }
      return copy
    })
    if (rows.length === 0) {
      console.log(`${table.padEnd(16)} — no rows`)
      continue
    }
    if (!COMMIT) {
      console.log(`${table.padEnd(16)} would upsert ${rows.length}`)
      continue
    }
    const { error } = await sb.from(table).upsert(rows, { onConflict: 'id' })
    if (error) {
      console.error(`${table.padEnd(16)} FAILED: ${error.message}`)
      process.exitCode = 1
    } else {
      console.log(`${table.padEnd(16)} upserted ${rows.length}`)
    }
  }

  console.log()
  console.log(COMMIT ? 'done.' : 'dry run complete — nothing was written.')
  if (ACCOUNTS_PASSWORD && COMMIT) {
    console.log()
    console.log('Staff sign-in (change these passwords after first login):')
    for (const u of data.users) {
      if (u._portal_email) console.log(`  ${u._portal_email.padEnd(38)} ${u.roles}`)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
