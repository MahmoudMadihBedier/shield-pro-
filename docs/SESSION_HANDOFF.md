# Session handoff — 2026-09-02

Phase 1 done + integrated. Shared document layer done. Wave 2a (admin) merged.
Wave 2b (purchasing ∥ manufacturing ∥ inventory) in flight.

## Branch — `feat/appwrite-scaffold` (pushed), HEAD `0024ec4`

```
0024ec4 feat(shared): submittable-document layer + harden submit/cancel
5053941 Merge Wave 2a (admin master-data module)
a15ffe4 feat(admin): Wave 2a — master-data module
8939103 fix(functions): wrap submit/cancel/post-* routes in a DB transaction
a34a9d4 chore: Phase 1 integration
6939d48 Merge Stories 1.3 + 1.5   · 4eccd6c 1.5 shared kit · 3b9930b 1.3 ledgers
e28c96e Merge Story 1.4          · 2dd089f 1.4 traceability
9c4f107 fix: Story 1.2 review    · f9fd875 1.2 routes · b58029f 1.1 auth
af03463 1.0 provisioner          · 55728c0 scaffold
```

Verify (repo root): `pnpm lint` (only pre-existing `src/app/router.tsx`
fast-refresh warnings) · `pnpm typecheck` (app+scripts+functions) · `pnpm test`
**174** · `pnpm build` · `pnpm fn:build`.

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

## In flight — Wave 2b (worktree agents, based on `0024ec4`)
- **purchasing** — `purchase_orders`, `stock_receipts`; PO line editor + total,
  receipt-vs-PO reconciliation, `postReceiptToLedger` → raw store.
- **manufacturing** — `production_requests`, `production_batches`; BOM explosion,
  costing, QC hold/release (pre-submit), `postBatchToLedger` (raw OUT / product IN).
- **inventory** — `warehouse_transfers` (4-step flow), `stock_count_sessions`
  (variance → sign-off), `write_offs`; read-only stock-on-hand over
  `bin_balances`; `postTransfer/WriteOff/CountAdjustment` to ledger.

## Next — Wave 2c/3 (after 2b merges + wired)
- **sales** + `rep_stock_issues` + `rep_closeouts` (rep custody = mobile
  warehouse; daily cash-up — Story 2.4, highest fraud value).
- **accounting** — GL views, `receipts`, `payment_vouchers`, credit limits +
  aging (Story 2.5). Wire `/post-gl` into invoice/receipt submit.
- **Story 2.1** — `/segregation-guard` route + RBAC/branch-scope in
  `/submit-document` (pay down the TODO(2.1) markers). Needs admin `users` schema
  (now available).
- **crm** portal (Phase 3 auth hardening) ∥ **hr**.
- Phase 4 reporting / Excel / dashboards.

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
