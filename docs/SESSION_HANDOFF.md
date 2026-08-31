# Session handoff — 2026-08-31

Pick up here after restarting Claude Code (needed to load the Appwrite MCP).

## Where things are

- **Branch:** `feat/appwrite-scaffold` (not pushed). Working tree clean.
- **Commits:**
  1. `55728c0` — scaffold: Vite + React 19 + TS SPA, Appwrite client + `client.ping()`,
     Clean Architecture skeleton, `core` primitives, docs, `vercel.json`.
  2. `af03463` — Phase 1 Story 1.0: `scripts/appwrite/schema.ts` (33 tables,
     declarative) + `scripts/appwrite/provision.ts` (idempotent runner).
  3. `b58029f` — Phase 1 Story 1.1: staff auth (data layer + `core/principal` +
     `AuthProvider`/`useAuth` + `LoginPage` + `RequireAuth`/`RequireRole` +
     `react-router` lazy routes).
- **Green:** `pnpm typecheck` (app + scripts), `pnpm lint`, `pnpm test` (20),
  `pnpm build`. `pnpm provision:dry` runs clean (452 objects planned).

## Decisions locked in (see docs/IMPLEMENTATION_PLAN.md §2)

- Appwrite **fully replaces** Supabase. `claude.md` Section C rewritten.
- **Vite SPA**, not Next.js — RSC rules in `claude.md` don't apply.
- **Offline-first dropped for v1** (online-only against Appwrite).
- Domain modelled on **ERPNext** patterns: naming series, `docstatus`
  (Draft/Submitted/Cancelled → amend, never edit), immutable Stock/GL ledgers,
  Bin projection, Workflow states, Role + branch scoping.
- Enforcement (SoD, approvals, sequence allocation, ledger posting, RBAC scope)
  lives in **Appwrite Functions**, never client code. Ledgers + submitted docs:
  no client write permission.
- `.env` (non-secret Appwrite client config) is **committed**; secrets go in
  `.env.local` (git-ignored).

## BLOCKED on live Appwrite access

Everything above is written but not exercised against a real backend. Two ways
to unblock (pick one):

1. **Appwrite MCP** — after restart, confirm `mcp__appwrite__*` tools exist, then
   list databases/buckets/users for project `shield-pro`
   (`6a95b631003d4163dc97`), and apply `scripts/appwrite/schema.ts` through the
   MCP (or just run the script — option 2).
2. **API key** — put a server key in `.env.local` (scopes in
   `.env.local.example`), then `pnpm provision`.

## Next steps, in order

1. **Provision the backend** (schema.ts → Appwrite): 11 role teams, `shield_pro`
   database, 33 tables + columns + indexes, seed `naming_series_counters`.
2. **Finish Story 1.1 end-to-end:** create one staff user in Appwrite, add them
   to a role team, set their `branchId` account pref, then verify login through
   `LoginPage` → `Principal` resolves with the right roles/branch.
   - Add the dev origin (`localhost`) + any Vercel domain as a **Web platform**
     in the Appwrite console or CORS blocks the SDK.
3. **Role-aware nav** in `AppLayout` (menu items gated by `RequireRole`).
4. **`branchId` admin flow** — right now it's read from an account pref that
   nothing writes yet; the admin module (Story: master data) will set it.
5. **Story 1.2:** `functions/` — `allocate-reference-id` (atomic counter),
   `submit-document`, `cancel-document`. Wire `core/doc-status` +
   `core/reference-id` to them.
6. **Story 1.3:** `post-stock-ledger` + `post-gl` Functions + `bin_balances`
   projection with cache invalidation.
7. **Story 1.4:** `traceability` module — reference-ID chain walker + `audit_log`
   viewer.

## Watch out for

- A local hook keeps rewriting `pnpm-workspace.yaml` with an invalid
  `allowBuilds:` block. It was deleted; `.npmrc` has
  `verify-deps-before-run=false` so `pnpm run <script>` works despite the
  ignored `esbuild` build script. If `pnpm` commands start failing on
  `ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds` once (interactive) or
  invoke tools via `./node_modules/.bin/<tool>` directly.
- `main.tsx` fires `pingAppwrite()` once on boot — console shows
  `[appwrite] ping ok …`. The home screen has the live indicator + "Ping now".
- Reference material (not in the repo): a shallow ERPNext checkout sits in this
  session's scratchpad; re-clone with
  `git clone --depth 1 --filter=blob:none --sparse https://github.com/frappe/erpnext`
  if needed.

## Vercel

`vercel.json` is in place (Vite preset + SPA rewrites). The user is setting up
Vercel themselves — do not run `vercel` commands.
