# Session handoff — 2026-08-31 (updated)

Backend is now provisioned and staff login is verified end-to-end.

## Where things are

- **Branch:** `feat/appwrite-scaffold` (not pushed).
- **Committed (4):** `55728c0` scaffold · `af03463` Story 1.0 provisioner ·
  `b58029f` Story 1.1 staff auth · `4da5263` prior handoff.
- **Uncommitted:** `scripts/appwrite/provision.ts` — bumped
  `waitForColumnsAvailable` from 30×1s to 150×2s (free-tier column workers take
  60–120s/table) and added a `failed`-status check. Lint + typecheck green.
  Not yet committed — fold into the Story 1.0 commit or a `fix:` follow-up.

## Live Appwrite state (project `6a95b631003d4163dc97`, `shield-pro`)

Provisioned via `pnpm provision` (real run, then re-run clean:
`0 created, 452 already present`):

- **11 RBAC teams** — one per `src/core/rbac.ts` role (`system_admin`, …).
- **Database `shield_pro`** — 33 tables, all columns + indexes `available`,
  `naming_series_counters` seeded (16 rows, `*-2026`).
- **Web platforms:** `*.vercel.app` (pre-existing) + `localhost` (id
  `weblocaldev`) — CORS OK for local dev.
- **API key `provisioner`** (no expiry) — in `.env.local` (git-ignored) as
  `APPWRITE_API_KEY`. Scopes: databases/tables/columns/indexes/rows +
  collections/attributes/documents (legacy) + teams + users + platforms +
  functions/executions. Reuse for Functions deploy + CI.
- **Staff user:** `admin@shieldpro.local` (id `6a95ca5444f38898d6cc`), member of
  team `system_admin` (role `owner`), no `branchId` pref (SystemAdmin has global
  scope). Password is in Claude auto-memory (not committed here); reset it in the
  Appwrite console → Auth if needed.

## Story 1.1 — verified

A throwaway script drove the real web-SDK login path over REST (cookie auth,
same as the browser): `sessions/email` → `GET /account` 200 → `GET /teams` →
`['system_admin']` → `getPrefs` `{}`. `buildPrincipal` ⇒
`{ userId: '6a95ca54…', roles: ['system_admin'], branchId: null }`.
`pnpm dev` + browser login through `LoginPage` still worth a manual smoke.

## Next steps, in order

1. **Commit** the `provision.ts` timeout fix.
2. **Role-aware nav** in `AppLayout` — menu items gated by role (`RequireRole`).
3. **`branchId` admin flow** — nothing writes the account pref yet; the admin
   master-data module will (System Admin only).
4. **Story 1.2 — `functions/`:** `allocate-reference-id` (atomic counter on
   `naming_series_counters`), `submit-document`, `cancel-document`. Wire
   `core/doc-status` + `core/reference-id`. Deploy with `npx appwrite deploy
   function` using the `provisioner` key. Needs a plan before coding.
5. **Story 1.3:** `post-stock-ledger` + `post-gl` Functions + `bin_balances`
   projection with cache invalidation.
6. **Story 1.4:** `traceability` module — reference-ID chain walker + `audit_log`
   viewer.

## Watch out for

- Free-tier column builds are slow; the provisioner now waits ~5 min/table.
- `pnpm-workspace.yaml` hook rewrite issue — see git log `4da5263` notes; if
  `pnpm` fails on `ERR_PNPM_IGNORED_BUILDS`, run `pnpm approve-builds` once.
- `main.tsx` fires `pingAppwrite()` on boot — console `[appwrite] ping ok`.
- Endpoint in `.env` is `https://fra.cloud.appwrite.io/v1`; MCP/console shows
  the non-region `https://cloud.appwrite.io/v1` — both fine, `fra` is the data
  region.

## Vercel

`vercel.json` in place. User owns Vercel setup — don't run `vercel`.
