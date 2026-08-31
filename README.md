# Shield Pro — ERP + CRM

شيلد برو — a manufacturing → distribution → field-sales → collection system.
One closed loop from buying raw material to cash returning to the main treasury,
with a two-person checkpoint on every handoff and a reference-ID chain behind
every transaction.

- **Frontend:** React 19 + TypeScript + Vite (SPA), Tailwind CSS v4
- **Server state:** TanStack Query · **Client state:** Zustand · **Validation:** Zod + React Hook Form
- **Backend:** [Appwrite](https://appwrite.io) Cloud (Databases, Auth, Functions, Realtime, Storage)
- **Reference architecture:** [ERPNext](https://github.com/frappe/erpnext) patterns — naming series, submittable docs, immutable ledgers, workflow states
- **Deploy:** Vercel

## Quick start

```bash
corepack enable        # provides pnpm
pnpm install
pnpm dev               # http://localhost:5173
```

The home screen shows a live **Appwrite connection** indicator; the app also
pings Appwrite once at startup (check the browser console for `[appwrite] ping ok`).

## Scripts

| Command             | Does                                    |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Vite dev server                         |
| `pnpm build`        | Type-check (`tsc -b`) then Vite build   |
| `pnpm preview`      | Serve the production build              |
| `pnpm test`         | Vitest (run once)                       |
| `pnpm test:watch`   | Vitest watch                            |
| `pnpm lint`         | oxlint                                  |
| `pnpm typecheck`    | `tsc -b` only                           |
| `pnpm format`       | Prettier write                          |

## Architecture

Clean Architecture, strict layer boundaries (`claude.md` §A.1, §B):

```
src/
  core/            Framework-free domain kernel: Result, AppError, doc-status,
                   reference-id, rbac. ZERO imports from react/vite/appwrite.
  shared/          config (env, Zod-validated), constants, formatters
  infrastructure/  Appwrite client + service singletons + error mapping + ping
  application/     Providers, TanStack Query setup, cross-cutting hooks
  presentation/    App shell, layout, shared components, pages
  modules/<name>/  data/ · domain/ · presentation/  (see src/modules/README.md)
```

## Configuration

`.env` (committed — these are **non-secret** public client values):

```
VITE_APPWRITE_ENDPOINT="https://fra.cloud.appwrite.io/v1"
VITE_APPWRITE_PROJECT_ID="6a95b631003d4163dc97"
VITE_APPWRITE_PROJECT_NAME="shield-pro"
```

Real secrets (Appwrite API keys, OAuth secrets) go in `.env.local` (git-ignored).

## Deployment

Push to a Vercel project (Vite preset). `vercel.json` handles the build command
and SPA rewrites. Add the Vercel domain as a **Web platform** in the Appwrite
console or the SDK is blocked by CORS. See `docs/APPWRITE_SETUP.md`.

## Docs

- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — phased build plan
- [`docs/APPWRITE_SETUP.md`](docs/APPWRITE_SETUP.md) — backend wiring & provisioning
- `SHIELD_PRO_REFACTOR_MASTER_PLAN.md`, `Shield_Pro_Business_Process_Documentation.md` — requirements
- `claude.md` — engineering rules for this repo
