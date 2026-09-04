# Session handoff — 2026-09-04

Phase 1 done. Shared document layer done. **Waves 2a (admin) + 2b (purchasing,
manufacturing, inventory) merged, wired, pushed.**

## Branch — `feat/appwrite-scaffold` (pushed), HEAD `bebfef2`

```
bebfef2 wire manufacturing routes/nav      · 11d215f Merge 2b manufacturing
4d06fd4 wire purchasing+inventory routes/nav · 5f1bb8b Merge 2b inventory
a6dbfab Merge 2b purchasing
0024ec4 feat(shared): submittable-document layer + harden submit/cancel
5053941 Merge Wave 2a (admin)               · a15ffe4 admin module
8939103 fix(functions): transaction wrapper on submit/cancel/post-*
a34a9d4 Phase 1 integration
6939d48 Merge 1.3+1.5 · e28c96e Merge 1.4 · 9c4f107 fix 1.2 · f9fd875 1.2
b58029f 1.1 auth · af03463 1.0 provisioner · 55728c0 scaffold
```

Verify (repo root): `pnpm lint` (only pre-existing `src/app/router.tsx`
fast-refresh warnings — count grows per lazy route) · `pnpm typecheck`
(app+scripts+functions) · `pnpm test` **322 / 45 files** · `pnpm build`
(no INEFFECTIVE_DYNAMIC_IMPORT) · `pnpm fn:build`.

## Modules shipped (all on `@/shared/documents` + `@/modules/admin` types)
- **admin** — 8 master-data entities, `/admin/*`, SystemAdmin-gated.
- **traceability** — chain walker + audit log, `/traceability`, `/audit-log`.
- **purchasing** — `purchase_orders`, `stock_receipts`; `/purchasing/*`;
  `postReceiptToLedger` → raw store.
- **manufacturing** — `production_requests`, `production_batches`;
  `/manufacturing/*`; BOM explosion, costing, QC-before-submit;
  `postBatchToLedger` (raw OUT / product IN).
- **inventory** — `warehouse_transfers` (4-step flow), `stock_count_sessions`,
  `write_offs`, read-only stock-on-hand; `/inventory/*`;
  `postTransfer/WriteOff/CountAdjustment` to ledger.

Module wiring pattern held: each module ships `routes.tsx` (`RouteObject[]`,
`React.lazy`, relative paths) + `nav.ts` (`NavItem[]`) + local `query-keys.ts`;
the shell (`src/app/router.tsx`, `src/presentation/layout/nav.ts`) imports the
**leaf** route/nav files (NOT the barrels — barrels pull every page into the main
chunk) and spreads them. Ledger `post*ToLedger` helpers absorb a re-post 409 as
`ok({ alreadyPosted: true })`.

## `shield-server` (Appwrite Function, project `6a95b631003d4163dc97`)
Deployment `6a9857afa1dbf2e234a0` active. **7 routes**, all verified live:
`/allocate-reference-id`, `/submit-document`, `/cancel-document`,
`/post-stock-ledger`, `/post-gl` (+ `/nope`→404). The four mutating routes run
inside a `runInTransaction` wrapper (`functions/common/transaction.ts`) — the
state change + its `audit_log` row commit together; concurrent writers of the
same row conflict. submit/cancel reject anonymous callers; submit strips the
draft's client write perms.
Redeploy: `pnpm fn:deploy` (build + `appwrite-cli functions create-deployment`).

## Foundations in place (what Wave 2 builds on)
- **`src/core/document.ts`** — `SUBMITTABLE_ENTITY_TABLE` + `tableForEntity` /
  `entityForTable` / `SUBMITTABLE_ENTITIES`, `documentEnvelopeSchema`.
- **`src/shared/documents/`** — `makeDocumentRepo({ entity, rowSchema })` →
  `list / get / createDraft / updateDraft / submit / cancel` (`Result`).
  `createDraft` allocates a gap-free `reference_id` then writes the Draft
  envelope + fields. Hooks: `useDocumentList`, `useDocument`,
  `useDocumentActions` (fills actor from `Principal`). **Every doc module uses
  this — never reimplement the lifecycle.**
- **`src/shared/{data-table,forms,ui}/`** — `DataTable` (controlled, 4 states,
  auto-virtualize >100), `Form` + field kit (RHF+Zod), `Button/Card/PageHeader/Badge`.
- **`src/modules/admin/`** — master data for branches, warehouses, users,
  products (+ BOM), raw materials, suppliers, customers. Exports row + input Zod
  schemas & `z.infer` types (`Branch`, `Product`, `Customer`, …), repos
  (`suppliersRepo`, `productsRepo`, …), `explodeBom`, enums. `/admin/*` routes,
  SystemAdmin-gated. `users-repo.setBranch` (profile column only — account-pref
  sync is a TODO(2.1)).
- **`src/modules/traceability/`** — chain walker + audit-log viewer,
  `/traceability` + `/audit-log`.

## Module wiring pattern (Wave 2b onward)
To keep parallel agents conflict-free, each module owns:
`src/modules/<name>/routes.tsx` → `export const <name>Routes: RouteObject[]`
(child route objects, relative paths, `React.lazy`); `nav.ts` →
`<name>NavItems: NavItem[]`; `query-keys.ts` (local factory). The **coordinator**
wires them into `src/app/router.tsx` + `src/presentation/layout/nav.ts` at merge.
Agents do NOT touch `router.tsx`, the shell `nav.ts`, `application/query/keys.ts`,
`functions/`, `scripts/`.

## Next — Wave 2c (empty module dirs already exist: sales, accounting, crm, hr)
- **sales** — `sales_invoices` (geo-locked, payment method), `rep_stock_issues`
  (rep custody = mobile warehouse), `rep_closeouts` (daily cash-up — Story 2.4,
  highest fraud value: issued = sold + returned + remaining; cash reconciled).
  Invoice submit → `/post-stock-ledger` (product OUT of rep custody) +
  `/post-gl` (revenue/AR). Needs rep stock + cash ledger read views.
- **accounting** — `receipts` (collections), `payment_vouchers`, GL views over
  `general_ledger_entries`, credit limits + aging buckets (Story 2.5:
  sale blocks when `outstanding + new > credit_limit`). Wire `/post-gl` into
  receipt/voucher submit.
- **Story 2.1** — new `/segregation-guard` route on `shield-server` +
  role/branch-scope check inside `/submit-document` & `/cancel-document` (pay
  down the `TODO(story 2.1)` markers in `functions/routes/`). Reads the `users`
  profile table (admin schema) for the caller's role + `branch_id`. Independent
  of the modules — can run parallel to Wave 2c. `functions/` only.

## Later
- **crm** portal (Phase 3 auth hardening — client_id ≠ password) ∥ **hr**
  (attendance, payroll, incentives).
- Phase 4 — reporting / Excel I/O / dashboards (consumes every module).
- Wire `/post-*` calls into the relevant submit actions across purchasing /
  manufacturing / inventory (helpers exist; some detail pages call them, verify
  every confirmed movement posts).

## Deferred / tech debt
1. `/submit-document`,`/cancel-document` still lack the caller **role + branch**
   check (only "not anonymous"). → Story 2.1. TODO markers in the route files.
2. Two concurrent FIRST posts of the same ledger voucher aren't deduped
   (transaction isolation ≠ uniqueness). Needs a unique index / lock row (schema
   frozen — schema v2).
3. `/allocate-reference-id` can leave a sequence gap on a lost response
   (documented; a reservation table would fix it).
4. Draft edit relies on Appwrite row security auto-granting the creator update
   perm — verify against a real user session; if not, add an `/update-draft` route.
5. `src/app/router.tsx` fast-refresh lint warnings grow with每 lazy route — a
   one-time `.oxlintrc` override for that file would silence them.
6. `traceability` `AuditLogPage` now uses `DataTable`; `@tanstack/react-virtual`
   moves out of the main bundle once a module page imports `DataTable` (admin does).

## Watch out for
- Agent `isolation: worktree` branches from the repo's FIRST commit — every
  agent prompt must `git reset --hard <HEAD-sha>` in step 0. Worktrees have
  collided (two agents in one) — keep an eye on `git worktree list`.
- `.claude/worktrees/` is git-ignored + vitest-excluded.
- Free tier: 2-Function cap (one `shield-server`); slow column builds; txn `ttl`
  min 60s.
- `pnpm-workspace.yaml`: `allowBuilds: { esbuild: true }` + `verifyDepsBeforeRun: false`.
- git user `madih` commits/pushes alongside this session.
- `provisioner` API key lacks `rules.*` (so `appwrite push` fails; `fn:deploy`
  uses `create-deployment`).

## Vercel
`vercel.json` in place. User owns Vercel — don't run `vercel`.
