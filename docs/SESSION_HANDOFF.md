# Session handoff — 2026-09-04

**Phase 1 + Wave 2 complete.** 7 business modules built, merged, wired, pushed.
Backend enforcement (transactions + SoD + RBAC/branch-scope) live on
`shield-server` and smoke-tested.

## Branch — `feat/appwrite-scaffold` (pushed), HEAD `2433629`

`pnpm lint` (only pre-existing `src/app/router.tsx` fast-refresh warnings, ~19
now) · `pnpm typecheck` (app+scripts+functions) · `pnpm test` **467 / 63 files**
· `pnpm build` (no INEFFECTIVE_DYNAMIC_IMPORT) · `pnpm fn:build`.

Recent commits: Wave 2c (sales `392c8ab`, accounting `cdc7780`, Story 2.1
`156b2e5`) each merged + wired; Wave 2b (purchasing/manufacturing/inventory);
Wave 2a (admin `a15ffe4`); `0024ec4` shared doc layer; `8939103` txn wrapper;
Phase 1 stories.

## Modules (all on `@/shared/documents` + `@/modules/admin` domain types)
| module | tables | routes |
| --- | --- | --- |
| **admin** | branches, warehouses, users, products+bom, raw_materials, suppliers, customers | `/admin/*` (SystemAdmin) |
| **traceability** | (read chain + audit_log) | `/traceability`, `/audit-log` |
| **purchasing** | purchase_orders, stock_receipts | `/purchasing/*` |
| **manufacturing** | production_requests, production_batches | `/manufacturing/*` |
| **inventory** | warehouse_transfers, stock_count_sessions, write_offs, bin_balances(read) | `/inventory/*` |
| **accounting** | receipts, payment_vouchers, general_ledger_entries(read) | `/accounting/*` |
| **sales** | sales_invoices, rep_stock_issues, rep_closeouts, rep_*_ledger(read) | `/sales/*` |

Each module: `routes.tsx` (`RouteObject[]`, `React.lazy` + own Suspense,
relative paths), `nav.ts` (`NavItem[]`), local `query-keys.ts`, `index.ts`
barrel. `src/app/router.tsx` + `src/presentation/layout/nav.ts` import the
**leaf** route/nav files and spread them. Each module's `post*ToLedger` /
`post*ToGl` helper absorbs a re-post 409 as `ok({ alreadyPosted: true })`.
`src/modules/{crm,hr}` are still empty.

## `shield-server` — deployment `6a9aafc0d60519f5cdc4` active. **6 routes:**
`/allocate-reference-id`, `/submit-document`, `/cancel-document`,
`/post-stock-ledger`, `/post-gl`, `/segregation-guard`.
- The 4 mutating routes run inside `runInTransaction` (state + audit atomic).
- `/submit-document` & `/cancel-document` now enforce (Story 2.1):
  `canSubmitTable(roles, table)` → `canActOnBranch(principal, doc.branch_id)` →
  `assertNoSelfApproval(row)` (the 4 SoD pairs). Caller roles + branch come from
  `loadCallerContext` → the `users` profile table.
- **Live-verified:** SoD violation → 403; valid submit → 200; `/segregation-guard`
  missing row → 404.
- A `users` profile row exists for the console account
  (`6a95b5e86b745f5a76c4`, `roles: system_admin`) so MCP smoke tests pass the
  RBAC gate. Real staff need a `users` row (admin module creates it).
- Redeploy: `pnpm fn:deploy`.

## Deferred / tech debt (carry forward)
1. **Two role sources**: client `Principal` uses **Teams**; `loadCallerContext`
   uses the `users.roles` **string** column (64 chars). They can drift. Fix
   (schema v2): resolve roles from Teams inside the Function, or make `roles` an
   array. `SUBMIT_ROLE_BY_TABLE` in `src/core/access.ts` is a first cut — tune.
2. SoD rule 4 is `created_by ≠ approved_by` (no dedicated purchase/payment actor
   columns — schema frozen).
3. Ledger voucher dedup is in-Function only (no DB unique on `*_ledger.voucher_no`).
4. `/allocate-reference-id` sequence gap on a lost response (documented).
5. `post*ToLedger` helpers exist and detail pages call them, but **not every
   confirmed-movement path is wired** — audit each module's submit/confirm
   actions actually post.
6. Approval workflow (`approval_requests`/`approval_rules`) — Story 2.2
   `/approve` route + engine — NOT built. Transfer/request status flows currently
   advance via `updateDraft` on a still-Draft row.
7. `rep_closeouts.expected` bag is hand-entered — needs a `rep-closeout` Function
   to build it from the day's issues/sales/returns (Story 2.4 completion).
8. Aging/GL repos scan client-side up to a row cap — move server-side (Plan §4.2).
9. `src/app/router.tsx` fast-refresh lint warnings — one `.oxlintrc` override.

## Next
- **Story 2.2** — `/approve` route + `approval_rules`/`approval_requests` engine
  (tiered auto-approve vs escalate; log every decision); exceptions dashboard.
- **Story 2.3** — `/fraud-scan` route → `fraud_flags` (round-tripping, repeated
  movement, high reversal ratio).
- **crm** module (Phase 3 — client portal, `client_id` ≠ password hardening).
- **hr** module (attendance, payroll, incentives).
- **Phase 4** — reporting / Excel I/O / dashboards (consumes every module).
- Wire the remaining `post*` calls (deferred #5); `NotificationService` over
  Realtime (Story 2.6).
- **Manual smoke**: `pnpm dev`, log in as `admin@shieldpro.local`, click through
  `/admin/*` → create master data → exercise a purchase→receipt→batch→transfer→
  invoice→receipt chain and confirm ledgers + `/traceability` populate.

## Watch out for
- Agent `isolation: worktree` branches from the repo's FIRST commit — every
  agent prompt must `git reset --hard <HEAD-sha>` in step 0. Agents also keep
  dying on flaky network / session limits — resume with a "run the gates" msg;
  their worktree work survives. Check `git worktree list` for orphans.
- `.claude/worktrees/` git-ignored + vitest-excluded.
- Free tier: 2-Function cap (one `shield-server`); slow column builds; txn ttl
  min 60s; MCP mutating calls sometimes hit the auto-mode classifier — retry.
- `pnpm-workspace.yaml`: `allowBuilds: { esbuild: true }` + `verifyDepsBeforeRun: false`.
- git user `madih` commits/pushes alongside this session.
- `provisioner` key lacks `rules.*` → use `fn:deploy` (create-deployment), not push.

## Vercel
`vercel.json` in place. User owns Vercel — don't run `vercel`.
