# Shield Pro CRM — concept & plan

Status as of **2026-09-11**, branch `feat/appwrite-scaffold`, migrations
**0001–0033** all live on the Supabase project. This is the authoritative,
current plan for the CRM surface — supersedes the three-bullet Phase 3
sketch in `IMPLEMENTATION_PLAN.md` (written pre-migration, for Appwrite).

## 1. Concept

Shield Pro's CRM is not a separate product bolted onto the ERP — it is the
**customer-relationship layer over the same `customers` table** everything
else already uses. It has two audiences, two auth models, two UIs:

| | Client Portal | Staff CRM |
| --- | --- | --- |
| Who | The customer themselves | Sales rep / branch / chief accountant / admin |
| Auth | PIN = password, synthetic email, own Supabase session | Normal staff login (shared session) |
| Where | `/portal/*` — its own layout, no ERP chrome | `/admin/customers/:id` (panels) + `/crm/leads` (its own page) |
| Does | Views own invoices, statement, changes own PIN | Logs interactions, tracks follow-ups, runs the lead pipeline, manages the customer's portal account |

Everything is branch-scoped RLS, server-authoritative (a UI control is an
affordance; the database enforces the real rule), and follows the same
domain → data → presentation layering as every other module.

## 2. What's built (this session, all live)

**Client portal**
- Isolated Supabase session (`portalSupabase`, its own `storageKey`) — a
  customer login no longer collides with a staff login in the same browser.
- Printable invoice (letterhead, 3-row totals) and a full running-balance
  account statement computed server-side (`portal_statement` RPC, migration
  0028) — credit-side invoices as debits, return credit notes + receipts as
  credits, matching the accounting-side statement and `customer_aging`.
- Staff-side lifecycle: create / reset PIN / revoke, `portal-account` Edge
  Function, audited. Gated to `system_admin` / `branch_accountant` /
  `chief_accountant`.
- **First live account**: البسملة ماركت (code 10001).

**Staff CRM — three slices, all mounted / routed**
1. **Activity log** (`crm_activities`, 0029) — call / visit / WhatsApp /
   meeting / complaint / note against a customer, on the customer detail page.
2. **Follow-up tasks** (`crm_followups`, 0030) — due-dated reminder assigned
   to a staff member, creator-or-assignee workflow, overdue badge.
3. **Leads / opportunity pipeline** (`leads`, 0031–0033) — its own page at
   `/crm/leads`, new → contacted → qualified → won/lost, stage transitions
   enforced server-side, "won" links to a real customer once one is created.

**Hardening applied across all three** (from code review, all live):
`branch_id` is always forced server-side by a trigger (never trusted from the
client — leads derive it from the caller, activities/follow-ups from the
linked customer); `created_by` is pinned immutable after creation so an
assignee can never hijack ownership and self-delete; every delete verifies
the row is actually gone (RLS can silently no-op a `DELETE`); ownership
checks live once in `core/rbac.ts` (`isOwnerOrAdmin`), not copy-pasted per
panel.

## 3. Known gaps (honest, not yet built)

- **No lead detail page.** `/crm/leads` is list-only — no drill-in to see a
  lead's own activity history, edit its fields, or see a timeline of stage
  changes over time.
- **No CRM-specific dashboard.** "My open follow-ups today", "leads by
  source", "stage conversion rate" don't exist anywhere yet.
- **Follow-ups aren't wired into notifications.** An overdue follow-up sits
  quietly on the customer page; it doesn't reach the existing in-app
  notification center (`Story 2.6`) the way a low-stock or pending-approval
  event does.
- **A won lead's history doesn't merge into the customer's activity log**
  once linked — they stay two separate timelines.
- **No bulk lead import.** Every lead is entered one at a time; there's no
  CSV upload (the existing `CsvImportPanel` facade from Phase 4.1 was built
  for exactly this shape of problem and isn't reused here yet).
- **No lead/activity export.** Every other report in the app has an
  `ExportButton`; leads and activity history don't.
- **Portal Story 3.2 is incomplete**: revoking a portal account bans the
  Auth user and kills the refresh token, but an already-issued access token
  (JWT) stays valid until it naturally expires — not an instant kill.
- **No dedicated CRM role.** The leads pipeline reuses `sales_rep` /
  `branch_accountant` / `chief_accountant` / `system_admin`. Fine for now;
  worth revisiting if a role that only does CRM (no accounting, no sales
  documents) ever shows up.

## 4. Roadmap

Ordered by effort-to-value, not by any fixed deadline — pick up wherever
makes sense.

### Phase A — close the loop on what exists (small, high value)
1. **Lead detail page** — `/crm/leads/:id`: full field edit, the stage
   history as a timeline, and (once "won" is linked) a jump to the customer.
   This is the single biggest usability gap today.
2. **Overdue follow-ups → notifications.** Reuse `NotificationService`
   (already wired for fraud flags / pending approvals) with a new
   `overdue_followup` kind; a cron-less approach: check on read (cheap) or a
   scheduled Edge Function (matches how other periodic checks in this
   codebase are done).
3. **CRM hub page** (mirrors `PurchasingHomePage`/module hub pattern) at
   `/crm` — "my open follow-ups", "my leads by stage", entry cards. Replaces
   the current single-item nav group with a real landing page.

### Phase B — operational completeness
4. **Bulk lead import** via the existing `CsvImportPanel` (pick/paste → Zod
   validate → preview → apply) — the exact tool this project already built
   for opening-stock/price-list imports.
5. **Export** leads + one customer's activity history to Excel
   (`ExportButton`, already a one-line wire-up everywhere else).
6. **Portal session hardening (Story 3.2 finish)** — either short-lived
   access tokens + a revocation check, or accept the current "kills within
   token lifetime" behavior as the documented trade-off. This is a real
   design decision, not a quick fix — flag to the business owner before
   committing effort.

### Phase C — deeper CRM (only if the business wants it)
7. **Merge a won lead's timeline into the customer's activity log** post-
   conversion, so the relationship history reads as one continuous record.
8. **Reminder delivery** (WhatsApp/SMS/email) for follow-ups — this was
   already flagged as a "later/optional" item in the master plan
   (`docs/IMPLEMENTATION_PLAN.md` §"Later / optional").
9. **CRM reporting** — conversion funnel (new→won rate by stage/source),
   rep performance (leads worked, win rate, avg. time-to-close), source ROI.
   Same pattern as the existing Phase 4.2 reports: a `SECURITY DEFINER` RPC
   aggregating server-side, a domain shaping layer, a printable page.

## 5. How to extend this (the pattern, for whoever picks up Phase A+)

Every slice built this session follows the same shape — copy it exactly for
new CRM surfaces:

1. **Migration**: a hand-written incremental file (`supabase/migrations/00NN_*.sql`,
   not a `schema.ts` regen — this project's tables past 0015 are all
   hand-written; see the note at the top of `0017`). RLS: read branch-scoped
   via `_can_read_branch`; `branch_id` and `created_by` forced server-side by
   a `BEFORE INSERT [OR UPDATE]` trigger — **never** trust either from the
   client, even for an "obviously fine" update; a System Admin `FOR ALL`
   override policy.
2. **Domain** (`src/modules/crm/domain/*.ts`): Zod row + form schemas, pure
   helpers (sort/label/guard functions), unit tests. Zero framework imports.
3. **Data** (`src/modules/crm/data/*-repo.ts`): thin `tablesDB` wrapper,
   `Result<T, AppError>`, delete always verifies the row is gone.
4. **Presentation**: a panel (drop onto `CustomerDetailPage`) or a routed
   page (`src/modules/crm/<feature>/`) — leaf-imported everywhere, never
   through the `crm` barrel (`AppProviders` imports `PortalAuthProvider` from
   that barrel eagerly; anything else exported there rides along into the
   main bundle — verified this matters: it changed the vendor chunk split).
5. Run `/code-review` before calling it done — every RLS hole found this
   session (ownership hijack, missing branch check, no server-side stage
   guard) was a review catch, not something visible from the UI.
