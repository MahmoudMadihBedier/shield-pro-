# Session handoff — 2026-09-06 (Appwrite → Supabase migration)

**The backend is now Supabase.** Appwrite is fully removed from the codebase.
Branch `feat/appwrite-scaffold` (name kept), all committed, not pushed.

## What moved

| Was (Appwrite) | Now (Supabase) |
|---|---|
| `scripts/appwrite/provision.ts` + console | `scripts/supabase/schema.ts` → `pnpm gen:schema` → `supabase/migrations/0001_init.sql` → `pnpm provision` (`supabase db push`) |
| collection/row permissions | RLS on every table (generated in `0001`) + `has_role()`/`user_roles()`/`user_branch_id()` SQL helpers reading `public.users` by `auth_user_id = auth.uid()` |
| `functions/` (`shield-server`, 19 routes) | Postgres `SECURITY DEFINER` RPCs in `supabase/migrations/0002`–`0005` + one Edge Function `supabase/functions/portal-account` (deployed) |
| Appwrite Auth + Teams | Supabase Auth (email+password); roles stay a slug string in `public.users.roles` |
| Appwrite Realtime | `supabase.channel()` `postgres_changes` on `public.notifications` |
| `appwrite` / `node-appwrite` SDKs | `@supabase/supabase-js` `^2` |

`src/infrastructure/appwrite/` **keeps its name** (path stability). It now holds:
`client.ts` (exports `supabase`), `query.ts` (`Query`/`ID` → Appwrite-shaped
JSON descriptors), `tables.ts` (`tablesDB` shim → PostgREST + `$id`↔`id`
mapping), `services.ts`, `errors.ts` (`mapAppwriteError` for
`PostgrestError`/`AuthError`), `auth.ts`, `functions.ts` (routes → `rpc()` /
Edge), `testing.ts` (test-only `AppwriteException`/`Query` shim).

## RPC inventory (all applied to the remote, auth-guards smoke-tested)

`allocate_reference_id`, `submit_document`, `cancel_document`,
`segregation_guard` (0002) · `post_stock_ledger`, `post_gl`, `decide_approval`,
`review_fraud_flag` (0003) · `evaluate_approval`, `fraud_scan` (0004) ·
`portal_me` / `portal_invoices` / `portal_invoice_detail` / `portal_receipts`
(0005). `0004`'s two re-express `src/core/approval.ts` + `src/core/fraud.ts` in
SQL — keep them in lockstep with the TS spec.

## Data migration (Phase 5)

Appwrite's API key is **billing-locked (HTTP 402)** — export was done through
the Appwrite console (MCP) and frozen into
`scripts/supabase/appwrite-export.json`. The project had **only master data**,
no transactional rows. Loaded into Supabase (`pnpm migrate:data -- --commit`):
branches 4, warehouses 5, suppliers 4, raw_materials 4, products 2,
product_bom 4, customers 2, users 12 (profiles). `naming_series_counters`
comes from the `0002` seed.

### STILL TO DO
1. **Staff auth accounts** — not created yet. Run
   `pnpm migrate:data -- --commit --accounts '<password>'` to create the 11
   Supabase Auth users (`admin@shieldpro.local` + 10 role emails) and rewrite
   `public.users.auth_user_id`. Waiting on the password to use.
2. **Rotate** the DB password + service-role key (were in chat history) once
   the user is settled on Supabase.
3. **Disconnect Appwrite** — user action (billing). Nothing in the repo needs it.
4. **pgTAP tests** for the `0002`–`0005` RPCs — the 145 deleted `functions/`
   unit tests have no replacement yet (647 tests pass, was 792).
5. Full **runtime** verification against real data (sign in as a migrated
   staff account, click through the modules) — the shim is structurally
   verified (typecheck + 647 tests) but not exercised end-to-end on Supabase.
6. `mapAppwriteError` / the `appwrite/` folder name — rename in a later pass.

## Feature work resumed (post-migration, same session)

Three built-but-incomplete stories finished, each server-authoritative + live-
verified against the Supabase project:

- **Story 2.2 — approval engine wired into submit.** `evaluate_approval` v2
  enriches context from the doc row (branch / new-customer / over-limit /
  amount); ungoverned movement types auto-approve; `submit_document` gated by
  `_approval_cleared`. Client `submit()` returns a `pending_approval` AppError
  on force-manual. (migration 0007)
- **Story 2.4 — rep daily close-out.** `build_rep_closeout_expected(rep,date)`
  assembles the bag from the day's issues/sales/returns/receipts;
  `confirm_rep_closeout` recomputes variance authoritatively, sets
  confirmed/flagged, submits, and notifies Admins on a flag. UI: "auto-compute"
  button + server confirm. (migration 0008; 0008 was repair-reapplied once for
  a plpgsql record/jsonb bug)
- **Story 2.5 — credit-limit hard block.** `check_customer_credit` +
  `record_credit_override` (System Admin / Chief Accountant, SoD-checked,
  logged); `submit_document` v3 blocks over-limit credit-side sales invoices
  unless an override marker exists. UI: live banner on the form, override form
  on the detail page. (migrations 0009 + 0010; 0010 fixed a latent 42804 in
  `_assert_no_self_approval`)

- **Story 4.3 — branch-scoped reads in RLS.** `gen-schema.ts` `readScope()` +
  `_has_global_scope` / `_can_read_{branch,warehouse,rep}` helpers; 22 tables'
  `_read` policies re-scoped (0001 regenerated to match; `0011` applies the
  delta). Branch roles see only their branch; global roles see all. No client
  change — RLS + count(exact) filter transparently. Live-verified.
- **Story 2.7 — QC hold/release enforced server-side.** `0012`: `_submit_gates`
  helper consolidates the approval/credit/QC submit gates; a
  `production_batches` submit requires `qc_status='released'` + `qc_by` set +
  `qc_by <> created_by` (SoD). `QcActionBar` now requires a reject reason and
  blocks the creator from self-signing.

Also fixed a migration-blocking bug: the `tablesDB` shim wasn't translating
`$createdAt`/`$id`/`$updatedAt` in **queries** (only in row output), so every
document list view failed with "The service is temporarily unavailable"
(`document-repo.list` sorts by `$createdAt`). `tables.ts` now maps them for
every operator; `tables.test.ts` added.

UI: primary nav moved from a left sidebar to a **top bar with per-module
dropdowns** (`TopNav.tsx` + `NAV_GROUPS` in `nav.ts`); hamburger panel below `lg`.

- **Phase 4.1 v1 — CSV import/export facade.** `src/core/csv.ts` (canonical
  `toCsv` + new `parseCsv`); `src/shared/excel/` (download wiring, generic
  `<ExportButton>`, reusable `<CsvImportPanel>` — pick/paste → per-row Zod
  validation → preview → Apply). Export wired into **Customer Aging** and
  **Stock on Hand**. Importer: `0013` `import_raw_material_prices` (System
  Admin only, by `code`, audited) behind a new `/admin/import` page
  (`DataImportPage`) in the Admin nav. `reports/domain/csv.ts` re-exports
  `@/core/csv` — one implementation. Remaining 4.1: more export surfaces
  (P&L / production-waste / rep cash-up), opening-stock + bank-statement
  importers.

- **System Admin god-mode (0014).** Per `rbac.ts` the admin is the "owner"
  role. It is now exempt from every SoD / approval / credit / QC submit gate;
  `admin_set_status(table,row,patch,reason)` forces any workflow status (audited,
  reason required); a per-table `<t>_admin_override` RLS policy (FOR ALL,
  `has_role('system_admin')`) on the 14 docs + attendance lets the admin edit
  any row via the normal forms. Immutable ledgers + audit_log + control tables
  stay admin-read-only. `<AdminOverridePanel>` mounted on the PO / production
  request / production batch / warehouse transfer / rep stock issue detail
  pages. 0001 regenerated to match.

- **Phase 4.2 v1 — server-side report aggregation (0015).** `trial_balance` and
  `customer_aging` now aggregate in Postgres over the whole GL / receivables
  (FIFO receipt application via a window function), branch-scoped
  (`_can_read_branch`). The `AGGREGATE_SCAN_CAP` / 5 000-row client loops in
  `gl-repo` / `aging-repo` are gone; the pure domain reducers stay the tested
  spec. `functions.ts` `fetchTrialBalance` / `fetchCustomerAging`.

- **User-request batch (5 items).**
  1. Customer→sales bug: new customers were stuck `pending_approval` with no way
     to approve → `CustomerDetailPage` now has an "اعتماد العميل" button
     (`admin_set_status`, audited).
  2. `src/core/geo.ts` + shared `<GeoField>` ("use my location" + Google Maps
     link) wired into the sales-invoice, customer and warehouse forms
     (`warehouses.geo` added, migration 0016).
  3. Capital contributions — a new submittable accounting document (owner /
     investor capital: cash or an existing asset), posts `Dr <asset_account> /
     Cr owners_capital`. migration 0017; `CapitalContribution` in
     core/{reference-id,document,access}; 3 pages under "رأس المال".
  4. Returns fixed — `return_requests.customer_id` + `refund_amount` (migration
     0018); `customer_aging` + `check_customer_credit` subtract submitted return
     refunds; form has a customer picker + refund field; detail page posts the
     `Dr sales_returns / Cr accounts_receivable` credit note.
  5. Multi-rep attribution — optional `{ user_id, branch_id }[]` on sales
     invoices + purchase orders (`reps` JSON column, migration 0019).
     `src/core/reps.ts` + shared `<RepBranchEditor>` (rep/branch repeater) on
     both forms; incomplete editor rows dropped on submit (`pickCompleteReps`,
     no silent validation dead-end); detail pages show `rep · branch` chips.
     `rep_user_id` stays the single custody / rep-ledger key. `useRepOptions` /
     `useBranchOptions` moved to `@/modules/admin` (single source of truth) —
     sales + purchasing re-export them.

- **Full-database export (`/admin/export`, System Admin).** One button →
  single `.xlsx`, one sheet per table (all 38: master + documents + ledgers +
  control) + a `_manifest` sheet. Self-contained OOXML writer: pure XML parts
  in `src/core/xlsx.ts`, `fflate` zips them in `src/shared/excel/xlsx.ts`
  (only new dep — tiny ZIP lib). `src/modules/admin/data/export-all.ts` pages
  every table (`Query.noCount()`, 1000/page, 100k cap, per-table error
  isolation) and calls `record_data_export` (migration 0020) to append an
  `audit_log` row. Live per-table progress + cancel + off-thread zip.

Migrations are now 0001–0020.

Customer approval is now reachable from the **customers list** too — an inline
"اعتماد" button per pending row (not just the detail page).

- **Profit & Loss statement (`/accounting/pnl`, Phase 4.2 + 4.1).**
  `src/modules/accounting/domain/pnl.ts` re-classifies the `trial_balance` RPC
  rows (0015, branch-scoped server-side — **no new backend call**) into P&L
  sections → Revenue − Returns = Net revenue − COGS = Gross profit − OpEx =
  Operating profit ± Other = **Net profit** + margin. `data/pnl-repo.ts`
  Zod-checks the RPC payload. Sectioned page + date range + CSV/Excel export
  (`profitAndLossToRows` emits deductions negative so the column foots).
  `classifyAccount` is conservative: only sales-side deductions count as
  contra-revenue; unknown / balance-sheet / purchase-side accounts are left
  off the statement until a real chart of accounts lands.

- **UI redesign (Pass 1, presentation only).** Corporate-blue theme tokens +
  semantic surface/text/border vars in `index.css`; working light/dark/system
  toggle (Zustand store `src/shared/theme/useTheme`, pre-paint resolver in
  `index.html`). Polished top-bar shell: `BrandMark`, module nav on its own
  wrapping row (dropdowns no longer clipped), `GlobalSearch` command palette
  (`/` or ⌘K), `Breadcrumbs`, `UserMenu`. Shared primitives reworked (Button
  `loading`/`block`, Card `interactive`/`flush`, Badge `dot`, new Skeleton /
  EmptyState / Spinner) so every page inherits the look; DataTable + form
  fields + module `<dialog>`s + Login/Home restyled.

- **Units of measure (3 commits).**
  1. `src/core/uom.ts` — fixed unit list (`pc, kg, g, ton, l, ml, box, carton,
     dozen, pack, bag, roll, sheet, m, cm`) + helpers. `raw_materials.uom` /
     `products.uom` are now an enum picklist (was free text); production
     deduction display shows units (BOM explosion, request detail, product BOM
     demand-per-unit). No data migration (`pc`/`kg` stay valid).
  2. `products.sale_units` (migration 0021) — JSON `[{unit,factor,label?}]`
     alternate selling units; `resolveSaleUnits` puts the stock unit first.
     Invoice line editor gains a Unit column; `qty` stays the stock-unit
     stock/pricing key, `sale_qty × factor` = `qty`. Sale-units editor card on
     the product detail page (`productsRepo.setSaleUnits`).
  3. `staff-account` Edge Function (deployed) — System-Admin create (Auth user
     + `public.users` profile), update (data/roles/branch/active + email),
     reset-password; all audited. `core/rbac.ts` ROLE_LABELS/OPTIONS +
     parse/serializeRoles; `admin/domain/staff.ts` Zod schemas;
     `StaffAccountForm` (multi-role checklist + branch/warehouse) wired into
     `UsersListPage` via a new `MasterListPage` `renderForm` override.

Migrations are now 0001–0024 (0022–0024 = `enforce_active_system_admin` trigger
on `public.users` — a demote/deactivate/delete can never leave zero active
System Admins; 0024 serialises concurrent demotions on a single
`pg_advisory_xact_lock` (0023's `FOR UPDATE` could deadlock); smoke-tested).
Edge Functions: `portal-account`, `staff-account`.
Warehouse `owner_user_id` and the staff-form warehouse field are proper
pickers (staff / active warehouses); `RelationField` keeps a persisted-but-
inactive value selectable so an edit can't wipe it.

- **Branding + printable bills.** `assets/logo.png` (`src/assets/logo.png`
  Vite-bundled, 900px/62KB). `<Logo>` in the top bar / login / portal.
  `<DocumentLetterhead>` (logo chip + company block + a `<PrintButton>`) on
  all 11 document detail pages and the accounting statements (trial balance,
  P&L, aging, GL, stock-on-hand). `PrintButton` → `window.print()`; `@media
  print` in `index.css` strips chrome via a `.no-print` class, forces light,
  never inverts the logo — so any page prints as a letterheaded sheet.

Remaining backlog: Phase 4.1 still wants production-waste / rep-cash-up /
customer-statement exports + opening-stock + bank-statement importers; Phase
4.2 could add inventory valuation, payroll cost, supplier performance, cash
position. UI redesign Pass 2 (per-page polish) not started. Operational:
rotate the DB password + service-role key, then disconnect Appwrite.

Note: commit `88bda05` (the export feature's first commit) was auto-generated
by tooling without the `Co-Authored-By` / `Claude-Session` trailers; the
follow-up `cf6830d` has them.

## Gates (this session): `pnpm typecheck` · `pnpm lint` (17 pre-existing
router.tsx fast-refresh warns) · `pnpm test` **718 / 94 files** · `pnpm build`.

## MCP
`.mcp.json` has the Supabase HTTP MCP (`project_ref=ajrevsyyudfjrwiifekj`).
The Appwrite MCP (console OAuth) still works read-only and was how the data
export happened despite the billing lock.

---

Everything below is pre-migration history — the Appwrite specifics are no
longer accurate, kept for the domain/wiring context only.

---

# Session handoff — 2026-09-05 (Wave 4 complete)

**Wave 4 done on top of everything below:** HR (attendance/incentives/payroll
— new schema: `payroll_runs`, `attendance_records`, `incentive_rules`,
`users.base_salary`), Story 2.6 notifications (in-app centre over Appwrite
Realtime, wired into fraud-scan + evaluate-approval as the worked example),
Phase 4 Story 4.4 reporting dashboard (KPIs, inline-SVG charts via the
`dataviz` skill, CSV export, no new dependency). Plus: `PortalAccountPanel`
mounted at `/admin/customers/:id`; `admin`'s `userRowSchema`/`customerRowSchema`
caught up to `base_salary`/`portal_user_id`. HEAD `f7317e1`, **792 tests**,
`shield-server` deployment `6a9c080093714beee083` (19 routes). Live-verified:
a `force_manual` approval decision creates a correctly-scoped notification
row (`update` permission on exactly the recipient). `src/modules/crm` is the
only module still lacking a schema-driven counterpart gap — none left; every
`docs/IMPLEMENTATION_PLAN.md` module area now has *something* built except
Phase 3 Story 3.1 follow-ups (reactivate route) and deeper Phase 4 (4.1/4.2/4.3).

Everything below this line is prior-wave history — still accurate, not
re-verified this pass.

---

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
