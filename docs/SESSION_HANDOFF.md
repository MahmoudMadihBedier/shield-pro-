# Session handoff — 2026-09-04 (Wave 3 complete)

**Phase 1 + Wave 2 + Wave 3 done.** 10 business modules, tiered approvals,
fraud detection, and a PIN-based CRM client portal — all merged, wired,
deployed, and live-smoke-tested.

## Branch — `feat/appwrite-scaffold` (pushed), HEAD `e3be6f5`

`pnpm lint` (only pre-existing `src/app/router.tsx` fast-refresh warnings) ·
`pnpm typecheck` (app+scripts+functions) · `pnpm test` **660 / 83 files** ·
`pnpm build` (no INEFFECTIVE_DYNAMIC_IMPORT) · `pnpm fn:build`.

## `shield-server` — deployment `6a9b0d72a93c2fe23880` active. **17 routes:**
`/allocate-reference-id`, `/submit-document`, `/cancel-document`,
`/post-stock-ledger`, `/post-gl`, `/segregation-guard`, `/fraud-scan`,
`/review-fraud-flag`, `/evaluate-approval`, `/decide-approval`,
`/portal-account/{create,reset,revoke}`, `/portal/{me,invoices,invoice-detail,receipts}`.

**Security hardening this wave (all live-verified):**
- `requireStaffCaller` on every write route that lacked it — a `users` profile
  row with ≥1 role IS staff; no row (a CRM portal account) is denied. Closes
  a real gap where `/allocate-reference-id`, `/post-stock-ledger`, `/post-gl`,
  `/segregation-guard` only checked "signed in", not "is staff".
- CRM portal accounts are **function-mediated only** — no `tablesDB` client
  ever reaches a customer session. Verified live: a customer session calling
  a staff route (`/segregation-guard`) → 403; `/portal/invoice-detail` on
  someone else's / a nonexistent invoice → 404/403, never a leak.
- Revocation kills live sessions immediately (`users.updateStatus(false)` +
  `users.deleteSessions`) — verified: a revoked PIN can no longer log in
  (`403 user_blocked`).
- Approval self-decision blocked (SoD) — verified live (`403 forbidden`).
- Unmatched approval rule → fail-safe `force_manual` — verified live.
- Deploy: `pnpm fn:deploy`. Function scopes: `rows.read/write`,
  `users.read/write`, `sessions.write`.

## Modules (10, all on `@/shared/documents` + `@/modules/admin` types)
admin · traceability · purchasing · manufacturing · inventory · accounting ·
sales · **returns** (Wave-3 gap fill) · **approvals** (Story 2.2) · **fraud**
(Story 2.3) · **crm** (Phase 3 client portal). `src/modules/hr/` still empty.

Wiring pattern held throughout: each module ships `routes.tsx`
(`RouteObject[]`, `React.lazy` + own Suspense, relative paths — CRM's
`portalRoutes` are the one exception, **top-level absolute** siblings of the
staff `/` branch, not nested in `AppLayout`), `nav.ts` (`NavItem[]`), local
`query-keys.ts`, `index.ts` barrel. The shell (`src/app/router.tsx`,
`src/presentation/layout/nav.ts`, `functions/server/src/main.ts`) imports
**leaf** files, never module barrels (barrels pull every page into the main
chunk). `AppProviders` now nests `PortalAuthProvider` alongside the staff
`AuthProvider` — both always mounted, independent of each other.

## CRM portal — how it works
A customer's **PIN is the password** on their own dedicated Appwrite Auth
account (`<code>@portal.shieldpro.local`, `src/core/portal.ts`). Appwrite owns
hashing/rate-limiting/sessions. Admin (`SystemAdmin`/`BranchAccountant`/
`ChiefAccountant`) creates/resets the account via `/portal-account/*` — the
8-digit PIN is returned once and never persisted. `customers.portal_user_id`
links the two. The portal (`/portal/login`, `/portal/*`) never touches
`tablesDB`; every read is `requireCustomerCaller`-scoped. Self-service PIN
change is a plain `account.updatePassword()` client call (no Function).
`src/modules/crm`'s `PortalAccountPanel` (admin-side create/reset/revoke UI)
is built but **not yet mounted** into a customer detail page — do that next
time a customer detail view exists in `@/modules/admin`.

## Deferred / tech debt (carry forward)
1. Two role sources: client `Principal` (Teams) vs `loadCallerContext`
   (`users.roles` string, 64 chars). Schema-v2 fix: resolve from Teams
   server-side, or make `roles` an array.
2. Ledger voucher dedup is in-Function only (no DB unique on `voucher_no`).
3. `/allocate-reference-id` sequence gap on a lost response (documented).
4. Not every module's "confirm movement" path is audited end-to-end for
   actually calling its `post*ToLedger` helper — spot-check needed.
5. Transfer/request status flows advance via `updateDraft` on a still-Draft
   row (no dedicated Function for arbitrary `status` changes) — fine for now,
   revisit if concurrent approvals become a real race.
6. `rep_closeouts.expected` is hand-entered; needs a Function to build it from
   the day's issues/sales/returns for Story 2.4 to be complete.
7. CRM: no reactivate route (revoke is one-way today — re-running `create`
   on an already-linked customer is blocked; add `/portal-account/reactivate`
   when needed). `PortalAccountPanel` not mounted anywhere yet.
8. Aging/GL/fraud-scan repos scan up to a row cap client/function-side — move
   server-side aggregation later (Plan §4.2).
9. `src/app/router.tsx` fast-refresh lint warnings — one `.oxlintrc` override
   would silence the growing pile permanently.

## Next
- **Mount `PortalAccountPanel`** into a customer detail view.
- **hr** module — needs new schema (attendance/payroll/incentives tables
  don't exist yet); design + `provision.ts` update needed first, same as the
  `customers.portal_user_id` column this wave.
- **Story 2.6** — `NotificationService` over Appwrite Realtime.
- **Phase 4** — reporting / Excel I/O / dashboards (consumes every module).
- Wire `/evaluate-approval` into the actual document-submit flows where the
  plan calls for auto-approve/escalate (currently a standalone route, not yet
  called from purchasing/sales/inventory submit actions).
- **Manual smoke**: `pnpm dev`, log in as `admin@shieldpro.local`
  (password in Claude memory), click through every module; a real branch
  ("menouf") and staff account already exist from earlier manual use — don't
  delete them.

## Watch out for
- Agent `isolation: worktree` branches from the repo's FIRST commit — every
  agent prompt must `git reset --hard <HEAD-sha>` in step 0.
- Agents die on flaky network / session rate-limits mid-run — **their work
  survives in the worktree**; resume with "run the gates and report" rather
  than restarting from scratch.
- When 3+ agents touch `src/infrastructure/appwrite/functions.ts` in
  parallel, expect an additive merge conflict there — resolve by keeping both
  sides in sequence (never a real logical conflict so far).
- `functions_update` (MCP) appears to be a full replace, not a patch — omitted
  optional fields (`execute`, `commands`) came back **empty** once. Always pass
  the complete current field set.
- `.claude/worktrees/` git-ignored + vitest-excluded.
- Free tier: 2-Function cap (one `shield-server`); slow column builds; txn ttl
  min 60s; Appwrite min password length 8 (why the PIN is 8 digits).
- `pnpm-workspace.yaml`: `allowBuilds: { esbuild: true }` +
  `verifyDepsBeforeRun: false`.
- git user `madih` commits/pushes alongside this session — a real branch and
  customer data may already exist from manual use; smoke-test data must be
  cleaned up carefully (this session always deletes what it creates).
- `provisioner` key lacks `rules.*` → use `fn:deploy` (create-deployment), not
  `appwrite push`.

## Vercel
`vercel.json` in place. User owns Vercel — don't run `vercel`.
