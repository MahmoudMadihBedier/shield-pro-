# Supabase backend — Shield Pro

The backend is **Supabase**: Postgres 17 + Auth + Row Level Security + the
PostgREST Data API + `rpc()` + Realtime + Storage + Edge Functions. It replaced
Appwrite; the `src/infrastructure/appwrite/` folder name is retained only so
import paths did not churn during the migration.

## Project

| | |
|---|---|
| Project ref | `ajrevsyyudfjrwiifekj` |
| URL | `https://ajrevsyyudfjrwiifekj.supabase.co` |
| Client SDK | `@supabase/supabase-js` `^2` |
| Region | Supabase Cloud |

## Environment

`.env` (committed, non-secret, ships in the browser bundle):

```
VITE_SUPABASE_URL="https://ajrevsyyudfjrwiifekj.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_…"
```

`.env.local` (git-ignored, secrets — see `.env.local.example`):

```
SUPABASE_PROJECT_REF="…"
SUPABASE_DB_URL="postgresql://postgres:…@db.…supabase.co:5432/postgres"
SUPABASE_DB_PASSWORD="…"
SUPABASE_SERVICE_ROLE_KEY="…"   # full DB access, bypasses RLS — server/CLI only
```

Only `src/shared/config.ts` reads `import.meta.env`; everything else imports the
validated `config` object.

## Schema is code

```
scripts/supabase/schema.ts          ← declarative table/column/index definitions (edit this)
        │  pnpm gen:schema
        ▼
supabase/migrations/0001_init.sql   ← 36 tables + enums/checks + unique constraints
                                      + indexes + RLS policies + RBAC helper fns
supabase/migrations/0002_core_rpc.sql       ← naming-series seed; allocate_reference_id,
                                              submit_document, cancel_document, segregation_guard
supabase/migrations/0003_document_rpc.sql   ← post_stock_ledger, post_gl, decide_approval,
                                              review_fraud_flag  (+ _require_staff, _notify_system_admins)
supabase/migrations/0004_approval_fraud_rpc.sql ← evaluate_approval, fraud_scan
supabase/migrations/0005_portal_rpc.sql     ← portal_me / portal_invoices / portal_invoice_detail
                                              / portal_receipts (customer-scoped reads)
supabase/functions/portal-account/          ← Edge Function: create/reset/revoke a customer
                                              portal auth account (needs auth.admin.*)
```

Apply everything:

```bash
npx supabase login
pnpm gen:schema                     # only if schema.ts changed
pnpm provision                      # supabase db push --include-all
pnpm fn:deploy                      # supabase functions deploy --use-api
```

Never hand-edit schema in the dashboard — change `schema.ts` (or the `0002+`
migrations for logic) and re-push.

## Access control

Every table has RLS enabled. Baseline policy set (generated in `0001`):

| kind | read | client write |
|---|---|---|
| master (`branches`, `products`, `users`, …) | any authenticated | `system_admin` only |
| document (`sales_invoices`, `purchase_orders`, …) | any authenticated | INSERT own Draft (`doc_status = 0 AND created_by = auth.uid()`); **no** UPDATE/DELETE |
| ledger (`stock_ledger_entries`, `general_ledger_entries`, `rep_*_ledger`, `bin_balances`) | any authenticated | none |
| control (`approval_requests`, `approval_rule_log`, `fraud_flags`, `audit_log`) | any authenticated | none |
| `notifications` | own rows only (`recipient_user_id = auth.uid()`) | UPDATE own (mark read) |
| `attendance_records` | any authenticated | INSERT/UPDATE own |
| portal | `sales_invoices` / `receipts` rows for the caller's linked `customers` row |

All submit/cancel/post/approve/scan paths go through `SECURITY DEFINER`
functions (owner `postgres`, so they bypass RLS) that re-check role, branch
scope and segregation of duties, and append to `audit_log`.

## RBAC

Roles are a space/comma-separated slug string in `public.users.roles`
(11 roles, `src/core/rbac.ts`). Helper functions, all
`stable security definer`, keyed by `auth_user_id = auth.uid()::text`:

- `user_roles() → text[]`
- `has_role(slug text) → boolean`
- `user_branch_id() → text`

Staff sign in with Supabase Auth (email + password). A `public.users` row with
at least one role slug **is** "staff"; a CRM portal account (auth user with a
`customers.portal_user_id` link and no `users` row) is not.

## Realtime

`useNotificationsRealtime` subscribes to `postgres_changes` on
`public.notifications` filtered to `recipient_user_id=eq.<uid>` and invalidates
the notification queries. A dropped socket degrades to normal refetch.

## One-time data migration

`scripts/supabase/appwrite-export.json` froze the Appwrite master data (the
project had no transactional rows). Load it:

```bash
pnpm migrate:data                              # dry run
pnpm migrate:data -- --commit                  # upsert rows
pnpm migrate:data -- --commit --accounts '<pw>'  # + recreate staff auth users,
                                                 #   rewrite users.auth_user_id
```
