# Appwrite Setup — Shield Pro

How the frontend talks to Appwrite, and how to provision the backend.

## Project details

| Key                | Value                              |
| ------------------ | ---------------------------------- |
| Project name       | `shield-pro`                       |
| Project ID         | `6a95b631003d4163dc97`             |
| Endpoint           | `https://fra.cloud.appwrite.io/v1` |
| Region             | Frankfurt (`fra`)                  |
| Web SDK (`appwrite`) | `^26` (installed)                 |

These three values are **non-secret client config**. They ship in the browser
bundle by design, exactly like a Firebase web config. They live in `.env`
(committed) as `VITE_APPWRITE_ENDPOINT`, `VITE_APPWRITE_PROJECT_ID`,
`VITE_APPWRITE_PROJECT_NAME`. Anything actually secret (an Appwrite **API key**
for Functions or CI, OAuth secrets) goes in `.env.local`, which is git-ignored.

## Client wiring (already done)

```
src/shared/config.ts                      # reads + Zod-validates the 3 env vars
src/infrastructure/appwrite/client.ts     # the single Client(), endpoint + project
src/infrastructure/appwrite/services.ts   # account / tablesDB / storage / functions / teams
src/infrastructure/appwrite/errors.ts     # AppwriteException -> typed AppError
src/infrastructure/appwrite/health/ping.ts# client.ping() wrapped in Result<>
```

`src/infrastructure/appwrite/client.ts`:

```ts
import { Client } from 'appwrite'
import { config } from '@/shared/config'

export const client = new Client()
  .setEndpoint(config.appwriteEndpoint)
  .setProject(config.appwriteProjectId)
```

### Startup ping

`src/main.tsx` calls `pingAppwrite()` once on boot and logs the result:

```
[appwrite] ping ok — 42ms @ 2026-08-31T...
```

The home screen also shows a live **connection indicator** with a **"Ping now"**
button (`src/presentation/components/ConnectionStatus.tsx`), polling every 30s.

Verify from a shell without the app:

```bash
curl -H 'X-Appwrite-Project: 6a95b631003d4163dc97' https://fra.cloud.appwrite.io/v1/ping
# -> Pong!
```

## Platforms (CORS allow-list)

In the Appwrite console → **Project → Settings → Platforms**, add a **Web** platform
for every origin the SDK runs from, or `client.ping()` and every call is blocked by CORS:

| Environment | Hostname                          |
| ----------- | --------------------------------- |
| Local dev   | `localhost`                       |
| Vercel prod | `shield-pro.vercel.app` (or your custom domain) |
| Vercel previews | `*.vercel.app`                |

## Backend architecture (target — not yet provisioned)

### Databases / Tables

One database, `shield_pro`. Table ids are registered in
`src/infrastructure/appwrite/collections.ts`. Categories:

- **Master data** — `products`, `product_bom`, `raw_materials`, `customers`,
  `suppliers`, `branches`, `warehouses`, `users`. Written by System Admin only.
- **Movement / transaction documents** — `purchase_orders`, `stock_receipts`,
  `production_requests`, `production_batches`, `warehouse_transfers`,
  `rep_stock_issues`, `sales_invoices`, `receipts`, `payment_vouchers`,
  `return_requests`, `write_offs`, `stock_count_sessions`, `rep_closeouts`.
  Each carries `reference_id`, `doc_status` (0/1/2), `created_by`, `branch_id`,
  and `amended_from` (nullable self-reference).
- **Immutable ledgers** — `stock_ledger_entries`, `general_ledger_entries`,
  `rep_stock_ledger`, `rep_cash_ledger`, `bin_balances`. **Append-only**, written
  **only** by Appwrite Functions (no client write permission, ever).
- **Control plane** — `approval_requests`, `approval_rules`, `approval_rule_log`,
  `fraud_flags`, `notifications`, `audit_log`, `naming_series_counters`.

### Auth & roles

- Appwrite **Auth** (email + password) for staff; the CRM client portal is
  hardened separately (see plan Phase 3).
- Roles from `src/core/rbac.ts` are modelled as **Teams** (one team per role) or
  user **labels**. Branch binding (`branch_id`) is a **user preference /
  membership attribute** set exclusively by the System Admin.
- Collection **permissions** give read to the right teams; **write is denied to
  everyone** on ledgers and confirmed documents — mutations go through Functions.

### Functions (server-side enforcement — the real controls)

| Function                | Responsibility                                                        |
| ----------------------- | -------------------------------------------------------------------- |
| `allocate-reference-id` | Atomic gap-free sequence from `naming_series_counters`               |
| `submit-document`       | Draft→Submitted: runs SoD guard + approval engine, posts ledgers, writes `audit_log` |
| `cancel-document`       | Submitted→Cancelled: posts reversing ledger entries                 |
| `segregation-guard`     | `requestedBy !== approvedBy`, `sentBy !== confirmedBy`, etc.         |
| `approval-engine`       | Tiered auto-approve vs. escalate; logs every decision               |
| `post-stock-ledger`     | The only writer of `stock_ledger_entries` + `bin_balances`          |
| `post-gl`               | The only writer of `general_ledger_entries`                         |
| `rep-closeout`          | Reconciles `rep_stock_ledger` + `rep_cash_ledger`, flags variance   |
| `fraud-scan`            | Round-tripping / repeated-movement heuristics → `fraud_flags`       |

### Realtime

Subscribe to `notifications` and `approval_requests` for the logged-in user's
scope to drive the in-app notification centre (plan Phase 2, Story 2.6).

### Storage

Bucket `evidence` for bank-transfer receipts, cheque images, signed delivery
notes. Read scoped to branch; write by the uploading role.

## Provisioning (to be scripted)

A `scripts/appwrite/provision.ts` using `node-appwrite` + an API key in
`.env.local` will create the database, tables, attributes, indexes, and
permissions idempotently. This is the Appwrite equivalent of ERPNext fixtures /
Supabase migrations — **the schema is code, never hand-edited in the console**.
Tracked as the first task in plan Phase 1.

## Local run

```bash
corepack enable          # provides pnpm
pnpm install
pnpm dev                 # http://localhost:5173
```

Open the app; the connection card should read **"Connected to Appwrite"**.
