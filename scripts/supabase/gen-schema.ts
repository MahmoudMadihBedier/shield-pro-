/**
 * Generate the Supabase (Postgres) schema from the SAME declarative table
 * definitions the Appwrite provisioner used (`scripts/appwrite/schema.ts`), so
 * the schema stays code and the two backends can't silently drift during the
 * migration.
 *
 * Emits `supabase/migrations/0001_init.sql`:
 *   - one `public.<table>` per Appwrite table (`id text PK`, `created_at`,
 *     `updated_at` timestamptz — the `tablesDB` shim renames these to
 *     `$id` / `$createdAt` / `$updatedAt` so the rest of the app is untouched)
 *   - Appwrite column types → Postgres (string→text, enum→text+CHECK,
 *     integer→bigint, float→double precision, boolean→boolean,
 *     datetime→timestamptz, string[]→text[])
 *   - unique indexes → UNIQUE constraints; key indexes → btree indexes
 *   - RLS enabled on every table + a baseline policy set (replaces Appwrite
 *     collection permissions — see the RLS section below)
 *
 * Usage:  pnpm tsx scripts/supabase/gen-schema.ts  then  supabase db push
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { TABLES, type Column, type TableDef } from '../appwrite/schema'

// ---------------------------------------------------------------------------
// classification (drives the RLS policy set)
// ---------------------------------------------------------------------------

const LEDGER_TABLES = new Set([
  'stock_ledger_entries',
  'general_ledger_entries',
  'rep_stock_ledger',
  'rep_cash_ledger',
  'bin_balances',
])
const CONTROL_TABLES = new Set([
  'approval_requests',
  'approval_rule_log',
  'fraud_flags',
  'audit_log',
])
/** master data: any signed-in user reads; only system_admin writes. */
const MASTER_TABLES = new Set([
  'branches',
  'warehouses',
  'users',
  'products',
  'product_bom',
  'raw_materials',
  'customers',
  'suppliers',
  'approval_rules',
  'incentive_rules',
  'naming_series_counters',
])

type Kind = 'document' | 'ledger' | 'control' | 'master' | 'notifications' | 'attendance'

function classify(def: TableDef): Kind {
  if (def.id === 'notifications') return 'notifications'
  if (def.id === 'attendance_records') return 'attendance'
  if (LEDGER_TABLES.has(def.id)) return 'ledger'
  if (CONTROL_TABLES.has(def.id)) return 'control'
  if (MASTER_TABLES.has(def.id)) return 'master'
  if (def.columns.some((c) => c.key === 'doc_status') && def.columns.some((c) => c.key === 'reference_id')) {
    return 'document'
  }
  return 'master'
}

// ---------------------------------------------------------------------------
// column → SQL
// ---------------------------------------------------------------------------

function q(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

function columnSql(col: Column): string {
  const name = `"${col.key}"`
  let type: string
  let dflt = ''
  let check = ''

  switch (col.type) {
    case 'string':
      type = col.array ? 'text[]' : 'text'
      if (col.default !== undefined && !col.array) dflt = ` DEFAULT ${q(col.default)}`
      break
    case 'enum':
      type = 'text'
      check = ` CHECK (${name} IN (${col.elements.map(q).join(', ')}))`
      if (col.default !== undefined) dflt = ` DEFAULT ${q(col.default)}`
      break
    case 'integer':
      type = 'bigint'
      if (col.default !== undefined) dflt = ` DEFAULT ${col.default}`
      if (col.min !== undefined || col.max !== undefined) {
        const parts: string[] = []
        if (col.min !== undefined) parts.push(`${name} >= ${col.min}`)
        if (col.max !== undefined) parts.push(`${name} <= ${col.max}`)
        check = ` CHECK (${parts.join(' AND ')})`
      }
      break
    case 'float':
      type = 'double precision'
      if (col.default !== undefined) dflt = ` DEFAULT ${col.default}`
      if (col.min !== undefined || col.max !== undefined) {
        const parts: string[] = []
        if (col.min !== undefined) parts.push(`${name} >= ${col.min}`)
        if (col.max !== undefined) parts.push(`${name} <= ${col.max}`)
        check = ` CHECK (${parts.join(' AND ')})`
      }
      break
    case 'boolean':
      type = 'boolean'
      if (col.default !== undefined) dflt = ` DEFAULT ${col.default}`
      break
    case 'datetime':
      type = 'timestamptz'
      break
  }

  const notNull = col.required ? ' NOT NULL' : ''
  // A required column with a default is still fine; a required column without a
  // default relies on every insert path supplying it (matches Appwrite).
  return `  ${name} ${type}${dflt}${notNull}${check}`
}

// ---------------------------------------------------------------------------
// table → SQL
// ---------------------------------------------------------------------------

function tableSql(def: TableDef): string {
  const declared = new Set(def.columns.map((c) => c.key))
  const cols = def.columns.map(columnSql)
  // A few Appwrite control/log tables declare their own `created_at` column
  // (it was distinct from Appwrite's `$createdAt`). Don't add a system column
  // that would collide — use the table's own where it exists.
  const sysCols: string[] = [`  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text`]
  if (!declared.has('created_at')) {
    sysCols.push(`  "created_at" timestamptz NOT NULL DEFAULT now()`)
  }
  if (!declared.has('updated_at')) {
    sysCols.push(`  "updated_at" timestamptz NOT NULL DEFAULT now()`)
  }
  const uniques = def.indexes
    .filter((i) => i.type === 'unique')
    .map((i) => `  CONSTRAINT "${i.key}" UNIQUE (${i.columns.map((c) => `"${c}"`).join(', ')})`)
  const keyIndexes = def.indexes
    .filter((i) => i.type === 'key')
    .map(
      (i) =>
        `CREATE INDEX IF NOT EXISTS "${i.key}" ON public."${def.id}" (${i.columns
          .map((c) => `"${c}"`)
          .join(', ')});`,
    )

  const body = [...sysCols, ...cols, ...uniques].join(',\n')

  return [
    `-- ${def.name} (${classify(def)})`,
    `CREATE TABLE IF NOT EXISTS public."${def.id}" (`,
    body,
    `);`,
    ...keyIndexes,
    `CREATE TRIGGER "${def.id}_set_updated_at" BEFORE UPDATE ON public."${def.id}"`,
    `  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();`,
    `ALTER TABLE public."${def.id}" ENABLE ROW LEVEL SECURITY;`,
    '',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// RLS policies per kind
// ---------------------------------------------------------------------------

function rlsSql(def: TableDef): string {
  const t = `public."${def.id}"`
  const kind = classify(def)
  const lines: string[] = [`-- RLS: ${def.id} (${kind})`]

  // everyone signed in can read every table (staff-wide read; branch/row
  // scoping tightened later — Plan §4.3). The exceptions override below.
  const readAll = `CREATE POLICY "${def.id}_read" ON ${t} FOR SELECT TO authenticated USING (true);`

  switch (kind) {
    case 'master':
      lines.push(
        readAll,
        `CREATE POLICY "${def.id}_admin_write" ON ${t} FOR ALL TO authenticated`,
        `  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));`,
      )
      break
    case 'document':
      lines.push(
        readAll,
        // clients may create a Draft they own; submit/cancel/amend go through
        // SECURITY DEFINER RPC. No client UPDATE/DELETE policy at all.
        `CREATE POLICY "${def.id}_create_draft" ON ${t} FOR INSERT TO authenticated`,
        `  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);`,
        `CREATE POLICY "${def.id}_update_draft" ON ${t} FOR UPDATE TO authenticated`,
        `  USING (doc_status = 0 AND created_by = auth.uid()::text)`,
        `  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);`,
      )
      break
    case 'attendance':
      lines.push(
        readAll,
        `CREATE POLICY "${def.id}_insert" ON ${t} FOR INSERT TO authenticated`,
        `  WITH CHECK (created_by = auth.uid()::text);`,
        `CREATE POLICY "${def.id}_update_own" ON ${t} FOR UPDATE TO authenticated`,
        `  USING (created_by = auth.uid()::text) WITH CHECK (created_by = auth.uid()::text);`,
      )
      break
    case 'notifications':
      lines.push(
        `CREATE POLICY "${def.id}_read_own" ON ${t} FOR SELECT TO authenticated`,
        `  USING (recipient_user_id = auth.uid()::text);`,
        `CREATE POLICY "${def.id}_mark_read" ON ${t} FOR UPDATE TO authenticated`,
        `  USING (recipient_user_id = auth.uid()::text) WITH CHECK (recipient_user_id = auth.uid()::text);`,
      )
      break
    case 'ledger':
    case 'control':
      // read-only to clients; every write is service_role / SECURITY DEFINER.
      lines.push(readAll)
      break
  }

  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// assemble
// ---------------------------------------------------------------------------

const header = `-- Shield Pro — Supabase schema (generated from scripts/appwrite/schema.ts)
-- Regenerate:  pnpm tsx scripts/supabase/gen-schema.ts
-- Do not hand-edit; add follow-on migrations for changes.

set check_function_bodies = off;

-- updated_at trigger shared by every table
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----- RBAC helpers (read the caller's own public.users profile) -------------
-- roles are stored as a comma/space separated slug string on public.users
-- (kept identical to the Appwrite model to bound migration churn).
create or replace function public.user_roles() returns text[]
  language sql stable security definer set search_path = public as $$
  select coalesce(
    string_to_array(regexp_replace(coalesce(u.roles, ''), '[[:space:]]+', ',', 'g'), ','),
    array[]::text[]
  )
  from public.users u
  where u.auth_user_id = auth.uid()::text
  limit 1
$$;

create or replace function public.has_role(p_role text) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_role = any(public.user_roles())
$$;

create or replace function public.user_branch_id() returns text
  language sql stable security definer set search_path = public as $$
  select nullif(u.branch_id, '') from public.users u
  where u.auth_user_id = auth.uid()::text limit 1
$$;

`

const tablesSql = TABLES.map(tableSql).join('\n')
const policiesSql = TABLES.map(rlsSql).join('\n')

// CRM portal: a customer's own Supabase session may read only its own
// invoices / receipts (adds to, doesn't replace, the staff read policy).
const portalSql = `-- ----- CRM portal: customer sees only its own documents ---------------------
create policy "sales_invoices_portal_read" on public."sales_invoices"
  for select to authenticated
  using (customer_id in (select id from public.customers where portal_user_id = auth.uid()::text));
create policy "receipts_portal_read" on public."receipts"
  for select to authenticated
  using (customer_id in (select id from public.customers where portal_user_id = auth.uid()::text));

-- ----- public.users: a user sees + edits its own profile row ----------------
create policy "users_read_self" on public."users"
  for select to authenticated using (auth_user_id = auth.uid()::text);
create policy "users_update_self" on public."users"
  for update to authenticated using (auth_user_id = auth.uid()::text)
  with check (auth_user_id = auth.uid()::text);
`

mkdirSync(resolve(process.cwd(), 'supabase/migrations'), { recursive: true })
const out = resolve(process.cwd(), 'supabase/migrations/0001_init.sql')
writeFileSync(out, `${header}\n${tablesSql}\n${policiesSql}\n${portalSql}\n`)
console.log(`wrote ${out} — ${TABLES.length} tables`)
