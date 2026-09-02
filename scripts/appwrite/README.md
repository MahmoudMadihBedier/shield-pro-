# Appwrite provisioning

`schema.ts` declares the whole backend schema. `provision.ts` applies it
**idempotently** — run it as many times as you like; it only creates what's
missing.

## What it creates

- 11 **RBAC teams** (one per staff role in `src/core/rbac.ts`)
- the **`shield_pro`** database
- every **table** in `src/infrastructure/appwrite/collections.ts`, with typed
  columns, indexes, and permissions:
  - _master data_ — read: any user · write: `system_admin` team
  - _documents_ — read + create: any user · submit/cancel via Functions (row
    security on)
  - _ledgers / control_ — read only; the sole writer is a Function using an API key
- seed rows in **`naming_series_counters`** (one per reference prefix, current year)

## Run

```bash
cp .env.local.example .env.local     # then paste an API key (see that file for scopes)
pnpm provision:dry                   # preview — no changes, no API key required
pnpm provision                       # apply
```

Re-run any time you add a table/column/index to `schema.ts`.

## Notes / v1 tradeoffs

- **Line items** are stored as a JSON string column (`lines`, `counts`, …), not
  child-table relationships. Fine for rendering an invoice; revisit if you need
  to query _inside_ line items.
- **Column changes aren't diffed** — the script adds missing columns/indexes but
  does not alter or drop existing ones. Renames/retypes are a manual migration.
- **Permissions aren't re-applied** to an existing table. If you change a table's
  permission set in `schema.ts`, update it in the console or extend the script
  with `updateTable`.
- Gap-free reference-ID allocation is the job of the `allocate-reference-id`
  Function (Story 1.2), which does an atomic increment on these counter rows.
