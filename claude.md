# claude.md

<!--
This file loads into context on EVERY message in this project.
Apply the Golden Test before adding any rule:
"Would removing this cause jules to make mistakes?" If not — cut it.
Do not restate language/framework defaults jules already knows. Only write
rules that override defaults or encode decisions specific to this project.
-->

---

# Section A — General Engineering Rules

## 1) Architecture & Separation of Concerns (YOU MUST FOLLOW)
- Follow the project's architecture layer boundaries strictly: presentation → domain → data
- Never bypass layers or mix responsibilities
- UI/presentation layer has ZERO business logic — only rendering, interaction, and local UI state
- Business logic (validation rules, workflow/approval logic, calculations, permissions logic) lives in the domain layer
- Data access (Appwrite SDK calls — `TablesDB` rows, `Functions`, `Storage`, `Realtime` — plus caching) lives in the data layer
- Do not introduce new abstractions or patterns without justification

## 2) Shared Code (IMPORTANT)
- Any reusable logic, utility, constant, hook, or component used in 2+ places goes in `src/core/` (or `src/shared/`)
- Check `core/` / `shared/` before creating new shared code — never duplicate across modules
- Common ERP/CRM primitives (data tables, filters, pagination, currency/date formatting, permission checks, audit-log helpers) belong in `core/` — never re-implemented per module
- `src/core/` is **framework-free**: no imports from `react`, `vite`, or `appwrite`

## 3) Error Handling
- Errors flow cleanly across layers — never skip layers
- Handle null, empty, loading, and error states explicitly in every screen/component — no silent failures
- Catch errors at the boundary (data layer), not deep inside business logic
- User-facing errors must be actionable (what happened, what to do next) — never raw stack traces or raw Supabase/Postgres errors in the UI

## 4) Change Discipline
- Make the smallest change that solves the problem
- Fix root causes, not symptoms
- Don't refactor unrelated code unless explicitly requested
- Never break existing functionality, APIs, flows, or UX unless explicitly instructed
- Read relevant code before modifying it — state assumptions when unclear
- Treat schema changes (Appwrite databases, tables, attributes, indexes, permissions) as high-risk — always via the idempotent `scripts/appwrite/provision.ts`, never manual console edits

## 5) Dependencies
- Don't add new packages without justification
- Any new package must be: latest stable, well-maintained, production-grade
- Prefer the platform/framework's built-in solution over a third-party package when reasonably equivalent

## 6) Security
- Never hardcode secrets, tokens, or credentials — use environment variables only
- Never log sensitive information (PII, customer data, financial records, tokens)
- Validate and sanitize all external and API input, both client-side and server-side (never trust client-side validation alone)
- Enforce access control on every Appwrite table that holds customer or financial data via **collection permissions + Appwrite Functions**. Ledgers and confirmed (submitted) documents ship with **no client write permission at all** — mutations go through Functions
- Every module must respect role-based access control (RBAC) and branch-scoped visibility; UI must hide/disable actions the current role cannot perform, but the real enforcement happens in Functions + collection permissions, never in the UI alone
- Proactively flag security risks when spotted, especially around branch data isolation and the segregation-of-duties rules

## 7) Testing
- Write tests for domain and data layer logic
- Bug fixes must include a reproducing test
- Tests must be deterministic — no flaky or timing-dependent tests
- One behavior per test case
- Critical business flows (invoicing, approvals, stock movement, lead/deal stage transitions, permission checks) require test coverage before merge

## 8) Workflow (Mandatory)
- Before marking any task done → run the `/code-review` skill
- After task approved → run the `/create-pr` skill for branch, commit, and PR output
- PR descriptions must always be in markdown (`.md`) format

---

# Section B — Frontend (React / TypeScript / Vite SPA) Specific Rules

Follow the standard TypeScript/React conventions and the project's oxlint + Prettier config.
Rules below only cover things that OVERRIDE defaults or encode project decisions.

> This project is a **Vite single-page app**, not Next.js. Any rule below that
> mentions Server Components / `next/*` is retained only for historical context —
> it does not apply. Routing is client-side (`react-router-dom`).

## 1) State Management
- Use **TanStack Query (React Query)** for all server/remote state — never store server data in local component state or global client stores
- Use **Zustand** for cross-cutting client-only state (e.g., active tenant/org, sidebar/UI state, current filters) — not Redux, not Context for high-frequency updates
- `useState` is allowed ONLY for local UI state (toggles, form focus, modal open/closed) — never for business or server data
- Keep state as close to the component that needs it as possible; lift only when genuinely shared

## 2) Types & Schema Validation
- No `any`. DB row shapes are defined as **Zod schemas** in `modules/<name>/domain/` (kept in lockstep with `scripts/appwrite/provision.ts`); they are the source of truth
- Use **Zod** for runtime validation of forms and every Appwrite/Function boundary — every form submission and every external payload is parsed through a Zod schema before use
- Derive TypeScript types from Zod schemas (`z.infer<...>`) instead of hand-duplicating types

## 3) Module Folder Structure
Each business module (admin, purchasing, manufacturing, inventory, sales, accounting, hr, crm, traceability) follows:
- `modules/{module_name}/data/` — Appwrite repositories (`TablesDB` rows, `Functions` calls, `Storage`, `Realtime`). Catch raw errors → return `Result<T, AppError>`
- `modules/{module_name}/domain/` — business rules, Zod schemas, workflow/approval logic, permission logic
- `modules/{module_name}/presentation/` — pages, components, hooks that consume domain/data

## 4) Domain Layer Purity
- Domain layer must have ZERO framework imports (no `react`, no `appwrite`, no `vite`, no JSX)
- Domain logic must be plain TypeScript, independently testable without rendering anything

## 5) Error Handling Contract
- Data layer: catch Appwrite/Function errors and map to typed `AppError` via `infrastructure/appwrite/errors.ts` — never leak an `AppwriteException` upward
- Domain + data layers: return `Result<T, AppError>` (`src/core/result.ts`) from use cases/repositories — no throwing across layer boundaries
- Presentation layer: map `Result` failures to user-friendly toasts/inline messages and explicit UI states (loading/empty/error)

## 6) Data Tables & Forms (ERP/CRM specifics)
- All list/grid views (customer lists, invoice lists, deal pipelines, inventory tables) use a single shared `DataTable` component from `core/` — supporting pagination, sorting, filtering, and column config consistently across modules
- All forms use **React Hook Form + Zod resolver** — no uncontrolled ad-hoc form state
- Long-running or bulk operations (bulk import, bulk invoice generation, mass email) must show progress state and be cancellable or resumable — never a blocking spinner with no feedback
- Currency, date, and number formatting always go through shared `core/formatters` utilities — never inline `toFixed()` or manual date string building, to keep locale/tenant settings consistent

## 7) Rendering & Performance Discipline (IMPORTANT)
- Code-split by route (`React.lazy` + `Suspense`); keep the initial bundle lean
- Memoize expensive derived data (`useMemo`) and callbacks passed to large lists (`useCallback`)
- Never fetch inside a loop when rendering a list — batch queries or use joins/views
- Virtualize any table or list expected to exceed ~100 rows (e.g., `@tanstack/react-virtual`)
- Debounce all search/filter inputs that trigger a network request

---

# Section C — Supabase Configuration

> The backend is **Supabase** (Postgres + Auth + RLS + PostgREST + RPC +
> Realtime + Storage + Edge Functions). It replaced Appwrite in the
> `feat/appwrite-scaffold` branch — the `src/infrastructure/appwrite/` folder
> name is kept only so import paths stayed stable. See `docs/SUPABASE_SETUP.md`
> for the backend architecture and `docs/IMPLEMENTATION_PLAN.md` for the
> ERPNext-modelled domain design.

## Project Details
- **Project ref**: `ajrevsyyudfjrwiifekj`
- **URL**: `https://ajrevsyyudfjrwiifekj.supabase.co` (Supabase Cloud)
- **Client SDK**: `@supabase/supabase-js` `^2`

## Environment Variables
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` live in `.env`
(**committed** — non-secret public client config that ships in the browser
bundle by design, like a Firebase config). Read + Zod-validate them **only** in
`src/shared/config.ts`; never touch `import.meta.env` elsewhere.
- Real secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, OAuth
  secrets) go in `.env.local` (git-ignored) and Vercel/CI secrets — never
  committed, never in the client bundle.

## Client Usage
- One browser client: `src/infrastructure/appwrite/client.ts` exports
  `supabase` (+ a `client` alias). A shim layer keeps the old surface:
  `tablesDB` (`src/infrastructure/appwrite/tables.ts` → PostgREST) and
  `Query` / `ID` (`.../query.ts` → Appwrite-shaped query descriptors), both
  re-exported from `.../services.ts`.
- All data-layer operations go through these — no direct `fetch` to the REST API.
- Raw errors (`PostgrestError` / `AuthError`) are mapped to `AppError` in
  `src/infrastructure/appwrite/errors.ts` (`mapAppwriteError`, name kept).

## Authentication
- Staff auth via Supabase **Auth** (email + password) —
  `src/infrastructure/appwrite/auth.ts`. No custom auth logic.
- Roles (`src/core/rbac.ts`, 11 roles) live as a space/comma-separated slug
  string in `public.users.roles`; `branch_id` is set **exclusively** by the
  System Admin. RLS helpers `has_role()` / `user_roles()` / `user_branch_id()`
  read the caller's `public.users` row by `auth_user_id = auth.uid()`.
- The CRM client portal is hardened separately — see plan Phase 3.

## Database & Access Control
- One database (schema `public`); table ids registered in
  `src/infrastructure/appwrite/collections.ts`.
- Movement/financial documents carry `reference_id`, `doc_status` (0 Draft / 1
  Submitted / 2 Cancelled), `created_by`, `branch_id`, `amended_from`.
- Every table has **RLS enabled**. Master data: read-all / write `system_admin`.
  Documents: clients may INSERT a Draft they own; no client UPDATE/DELETE.
  **Immutable ledgers** (`stock_ledger_entries`, `general_ledger_entries`,
  `rep_stock_ledger`, `rep_cash_ledger`, `bin_balances`) and **control tables**
  are read-only to clients — the only writers are `SECURITY DEFINER` functions.
- Segregation of duties, tiered approvals, sequence allocation, ledger posting
  and branch-scope enforcement all live in Postgres RPCs
  (`supabase/migrations/0002`–`0005`) and the `portal-account` Edge Function —
  never in client code. Every state-changing RPC appends to `audit_log`.

## Schema Management
- Schema is code: edit `scripts/supabase/schema.ts`, run `pnpm gen:schema` to
  regenerate `supabase/migrations/0001_init.sql`, then `pnpm provision`
  (`supabase db push --include-all`). Server logic lives in the hand-written
  `0002`–`0005` migrations. Never hand-edit schema in the Supabase dashboard.

## CLI
```bash
npx supabase login
pnpm gen:schema                 # regenerate 0001_init.sql from schema.ts
pnpm provision                  # supabase db push --include-all
pnpm fn:deploy                  # supabase functions deploy --use-api
pnpm migrate:data -- --commit   # one-time Appwrite→Supabase data load
```