# Session handoff — 2026-09-01 (Phase 1 complete)

Phase 1 (Foundation & Traceability backbone) is done, integrated on
`feat/appwrite-scaffold`, and green. `shield-server` redeployed with 5 routes.

## Branch state — `feat/appwrite-scaffold` (pushed)

```
6939d48 Merge Stories 1.3 (ledgers) + 1.5 (shared UI kit)
4eccd6c feat(shared): Phase 1 Story 1.5 — DataTable, form kit, RTL shell
3b9930b feat(functions): Phase 1 Story 1.3 — ledger posting routes
e28c96e Merge Story 1.4 (traceability)
2dd089f feat(traceability): Phase 1 Story 1.4 — chain walker + audit-log viewer
9c4f107 fix(functions): address Story 1.2 code-review findings
f9fd875 feat: Story 1.2 — allocate / submit / cancel document routes
b58029f Story 1.1 staff auth · af03463 Story 1.0 provisioner · 55728c0 scaffold
```

Verification (repo root): `pnpm lint` (only pre-existing `src/app/router.tsx`
fast-refresh warnings) · `pnpm typecheck` (app+scripts+functions) · `pnpm test`
**122 passing / 20 files** · `pnpm build` · `pnpm fn:build`.

## Phase 1 — what shipped

| Story | Deliverable | Notes |
| --- | --- | --- |
| 1.0 | `scripts/appwrite/{schema,provision}.ts` — 33 tables, idempotent | provisioned live |
| 1.1 | staff auth (Appwrite email+pw, `Principal` from teams + `branch_id`, guards, lazy routes) | login verified |
| 1.2 | `shield-server` routes `/allocate-reference-id`, `/submit-document`, `/cancel-document` | deployed + smoke-tested |
| 1.3 | `core/ledger.ts` + routes `/post-stock-ledger`, `/post-gl` + `bin_balances` upsert | deployed + smoke-tested |
| 1.4 | `modules/traceability` — chain walker (14 reads/node, bounded) + audit-log viewer; routes `/traceability`, `/audit-log` | UI unwired into nav |
| 1.5 | `src/shared/{data-table,forms,ui}` + RTL/Arabic `AppLayout` shell + `nav.ts` | not yet consumed by a route |

### `shield-server` (Appwrite Function `6a95b631003d4163dc97` / project `shield-pro`)
Deployment `6a9717255343af18acbc` active. 5 routes, all verified live:
`/nope`→404, `/submit-document` bad row→404, `/allocate-reference-id`→`ADJ-…`,
`/post-gl` unbalanced→400, `/post-stock-ledger` negative→400 / ok→200 / re-post→409.
Auth = per-execution dynamic API key; `execute: users`; scopes `rows.read`/`rows.write`.
Redeploy: `pnpm fn:deploy` (builds + `appwrite-cli functions create-deployment`).

## Live Appwrite state (unchanged infra)
- 11 RBAC teams; DB `shield_pro` 33 tables; web platforms `*.vercel.app` + `localhost`.
- API key `provisioner` in `.env.local` — has functions/executions/rows/etc.,
  **lacks `rules.*`** so `appwrite push function` fails; `fn:deploy` uses
  `create-deployment` which works.
- Staff user `admin@shieldpro.local` in team `system_admin` (pw in Claude memory).
- Smoke-test rows were cleaned up; `ADJ-2026` counter reset to 1.

## Deferred / tech debt (do NOT lose track)
1. **submit/cancel: no caller RBAC or branch scope** — any authenticated user can
   transition any doc. → **Story 2.1** (`/segregation-guard` + RBAC-in-function).
2. **submit/cancel/post-* TOCTOU** — read-check-write isn't atomic; concurrent
   calls can double-transition / double-post. Needs a `node-appwrite` transaction
   wrapper in `functions/common`. Do before wiring `/post-*` into `/submit-document`.
3. **Sequence gaps on retry** — `/allocate-reference-id` consumes N before it
   returns; a lost response leaves a gap. Documented limitation (ERPNext has them
   too); a reservation table would be the real fix.
4. **No DB unique index on `*_ledger_entries.voucher_no`** — single-post is
   guarded only in-Function. Schema is frozen; revisit if we do a schema v2.
5. **`traceability` + shared kit not wired into nav** — `AppLayout` `NAV_ITEMS`
   only has Home; add `traceabilityNavItems`. `AuditLogPage` still renders a plain
   table (`// TODO: swap to shared DataTable`).
6. `@tanstack/react-virtual` currently lands in the main bundle (no route imports
   `DataTable` yet) — moves to a chunk once a module page uses it.

## Next — Wave 2 (modules, dependency order)
Per plan §6. Each module = `src/modules/<name>/{data,domain,presentation}`,
Zod schemas in `domain/` (lockstep with `schema.ts`), repos → `Result`,
pages built on `@/shared/{data-table,forms,ui}`.
1. **admin** (master data: branches, warehouses, users, products, BOM, raw
   materials, suppliers, customers) — everything needs it; includes the
   System-Admin-only `branch_id` binding flow.
2. purchasing ∥ manufacturing ∥ inventory (supply half + wire `/post-*`).
3. sales + `rep_closeouts`; accounting (GL, receipts, vouchers, credit/aging).
4. crm portal (Phase 3 auth hardening) ∥ hr.
5. Phase 2 controls (`/segregation-guard`, `/approve`, `/fraud-scan`, credit
   limits, QC hold, returns) woven in as modules land.
6. Phase 4 reporting / Excel / dashboards.

Also: Story 2.1 pays down deferred #1 + #2.

## Watch out for
- **Agent worktrees**: `isolation: worktree` branches from the repo's FIRST
  commit, not HEAD. Tell each agent to `git reset --hard <current-HEAD-sha>`
  first. Worktrees can also collide (two agents landed in one this session).
  `.claude/worktrees/` is git-ignored and excluded from vitest.
- Free tier: 2-Function cap (→ one `shield-server`); slow column builds.
- `pnpm-workspace.yaml` carries `allowBuilds: { esbuild: true }` +
  `verifyDepsBeforeRun: false` (pnpm 11 moved these out of `.npmrc`).
- Someone (git user `madih`) has been committing/pushing alongside this session.

## Vercel
`vercel.json` in place. User owns Vercel — don't run `vercel`.
