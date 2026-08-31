# Shield Pro ERP + CRM — Refactor & Hardening Master Plan
### Engineering Brief for Claude Code

**Document type:** Product & Engineering Plan ("the story")
**Audience:** Claude Code, acting as Senior Software Engineer / Tech Lead on this codebase
**Source material:** `PROJECT_DOCUMENTATION.md`, `REFACTORING_GUIDE.md`, `CRM_AUTHENTICATION_SETUP.md`, `Shield_Pro_Business_Process_Documentation.md` (all in this repo/context — read them before touching code)

---

## 0. How to Use This Document

This is not a spec to implement line-by-line in one pass. It is a **backlog of epics**, written the way a product/eng team would write it, so that work can be picked up incrementally, PR by PR, without breaking the running system.

**Operating rules for Claude Code on this project:**

1. **Read before you write.** Before touching any module, read the existing implementation end-to-end (repository → service → hook → component) for that module. Do not assume the docs match the code — the docs may be aspirational. If code and docs disagree, trust the code, then flag the discrepancy.
2. **No silent architecture drift.** This project already made an architectural decision (Clean Architecture: `core` / `infrastructure` / `application` / `presentation` / `shared`, Repository + Factory + Strategy + Observer + Facade + Singleton patterns). Stay inside that architecture. If a fix genuinely requires bending it, say so explicitly in the PR description — don't quietly do it differently in one corner of the codebase.
3. **Ship in reviewable slices.** One epic (or one clearly-scoped story) per PR/branch. Each slice must build, lint, and pass tests on its own — never leave the tree in a broken state between stories.
4. **Every backend change gets a matching frontend contract check.** This project's core complaint is "backend/frontend integration issues." For every service/repository method touched, verify: the TypeScript interface, the hook that calls it, the component that renders its result, and the Supabase RPC/RLS policy (if remote) all agree on shape, nullability, and error handling.
5. **Never fix a symptom without fixing the control.** If you find a bug that let bad data get created (e.g., a race condition that let stock go negative), the fix is not just "add a null check" — the fix is closing the control gap (see Section 5, "Anti-Fraud & Anti-Human-Error Controls"), so the same class of bug can't recur elsewhere.
6. **Write migrations, not manual SQL hacks.** All schema changes are versioned migration files, following the existing `000X_description.sql` convention seen in `CRM_AUTHENTICATION_SETUP.md`.
7. **Every state-changing action gets an audit_log entry.** No exceptions. This is both a business requirement (traceability) and a debugging requirement (you will need this to verify your own fixes).

---

## 1. The Story (Why We're Doing This)

Shield Pro started as a working prototype: a factory produces goods, a main warehouse receives them, branch warehouses receive from the main warehouse, sales reps sell to customers, accountants track the money, and an administrator sits on top approving things and setting prices. The instinct was right. Two things are now getting in the way of it becoming a real, sellable, audit-proof product:

1. **Technical debt at the backend/frontend seam.** Repositories, services, hooks, and components were built quickly and some of them don't agree with each other anymore — stale types, inconsistent error handling, sync logic that doesn't always match what the UI assumes, and a CRM auth scheme (`CRM_AUTHENTICATION_SETUP.md`) that has a serious flaw baked in (see Epic 9 — the password *is* the client ID, which is shared over WhatsApp).
2. **The system currently trusts people too much.** Every "approval" is a single click by a single role. There's no rule that the person requesting a stock movement can't also be the person confirming it arrived. There's no ledger that says "this sales rep should have exactly X units and Y cash in hand right now" — so a bad actor (an employee, not necessarily an outsider) can move goods back and forth between warehouses, generate repeated requests/approvals, and quietly create discrepancies that get lost in the noise of cached reports and stale dashboards. This is the "human mistake and human scam" problem the business owner is worried about, and it is a **known, solved problem in ERP design** — it's called segregation of duties plus an immutable reference-ID ledger, and `Shield_Pro_Business_Process_Documentation.md` (Sections 4–6) already lays out exactly what's missing.

**The mission:** refactor the backend↔frontend seam until it's clean and correct, then build the control layer that makes the system resistant to both honest mistakes and deliberate manipulation — without turning the Administrator into a bottleneck who has to click "approve" a thousand times a day.

---

## 2. Current State (Baseline — Verify, Don't Assume)

- **Stack:** React 18 + TypeScript + Vite, Tailwind CSS, Dexie (IndexedDB, offline-first local store), Supabase/PostgreSQL (remote), Framer Motion, Leaflet (GPS), ZXing (barcodes). PWA-enabled, offline-first with sync-on-reconnect.
- **Architecture:** `core/` (domain, interfaces, types) → `infrastructure/` (Dexie repos, sync, Supabase client) → `application/` (services, hooks) → `presentation/` (components, pages) → `shared/` (utils, constants, config). Repository + Factory + Strategy + Observer + Facade + Singleton patterns are already in use.
- **Modules that exist today:** Dashboard, Sales & Customers (+ CRM client portal), Purchases & Suppliers, Inventory & Warehouse, Manufacturing (two-stage: batch production → packaging/filling), Accounting & Finance (double-entry), Payroll/HR/Attendance.
- **CRM:** client-portal customers authenticate with `client_id` only; the underlying Supabase auth user's password is literally set to the `client_id` string. This is a functional convenience today and a **security liability** the moment a `client_id` leaks (it's shared over WhatsApp by design).
- **Known gap (self-identified in `Shield_Pro_Business_Process_Documentation.md`):** no QC hold step, no rep stock/cash-in-hand ledger, no tiered auto-approval, no returns/damages workflow, no physical stock count/audit module, no credit-aging automation, no notification/alerting layer, no standardized Excel import/export contract.

Claude Code should treat the bullet list above as a hypothesis to confirm against the actual repo, not as ground truth.

---

## 3. Phase 0 — Stabilization Audit (Do This First, Before Any New Feature)

Goal: make the existing system internally consistent before adding controls on top of it. New features built on a shaky foundation just add new bugs.

### Story 0.1 — Repository/Service/Hook Contract Audit
As a developer, I need every repository method's return type to match what its service expects, and every service method's return type to match what its consuming hook expects, so that TypeScript's type system is actually protecting us instead of being silenced with `any`.
- Grep for `any`, `as any`, `@ts-ignore`, `@ts-expect-error` across `core/`, `infrastructure/`, `application/` — each one is a suspect.
- Confirm every repository implements its full interface (no partial/optional implementations that silently return `undefined`).
- Confirm pagination parameters (page size, offset/limit) are honored identically in Dexie repos and Supabase repos — a common bug source in offline-first apps is the two backends drifting apart.

### Story 0.2 — Sync Logic Correctness
As a factory/warehouse worker on a spotty connection, I need my offline actions to sync exactly once and in the correct order, so that a production batch or stock transfer never gets double-counted or applied out of order.
- Audit the sync queue: is it idempotent (safe to retry)? Is there a per-record version/timestamp to resolve conflicts?
- Confirm optimistic UI updates roll back correctly if a sync operation fails or is rejected server-side (e.g., an approval that got rejected while the rep was offline).
- Add integration tests specifically for offline → reconnect → sync scenarios for: production batch submission, stock transfer, sales invoice creation.

### Story 0.3 — Caching & Stale Report Audit
As an accountant or administrator, I need the numbers on my dashboard and reports to reflect the true current state of the database, so that a discrepancy can never hide behind a stale cache.
- Identify every place data is cached (LRU cache mentioned in `REFACTORING_GUIDE.md`, React Query/SWR if used, component-level memoization).
- For every cached value that represents money or stock quantity, add explicit, correct cache-invalidation on every mutation that affects it. A stock quantity cache must be busted the instant a movement, approval, or reversal touches that item/warehouse — no TTL-only invalidation for financial or inventory figures.
- Any report used for reconciliation (daily cash report, stock aging report, rep cash-up report) must be computed live or from an event-sourced ledger, never served purely from a cache that could be one mutation behind. This directly closes the "cache and reports" manipulation risk flagged by the business owner: a bad actor should not be able to time an action to land in a stale-report blind spot.

### Story 0.4 — Error Handling Consistency
As a user of any role, I need a failed action (rejected approval, network error, validation failure) to show me a clear reason, not a silent failure or a generic error, so that I don't assume something succeeded when it didn't.
- Standardize a `Result<T, E>`-style return (or thrown, typed domain errors) across all services — pick one pattern and apply it everywhere; do not leave a mix of thrown exceptions and `{ success: boolean }` objects.
- Every mutation in the UI must surface success/failure to the user explicitly (toast/banner), including the specific business reason (e.g., "blocked: exceeds customer credit limit," not just "error").

**Definition of done for Phase 0:** `npm run build`, `npm run lint`, `npm run test` all pass; no `any`/`@ts-ignore` remain in touched files; a short `PHASE_0_AUDIT_FINDINGS.md` is produced listing every inconsistency found and fixed, so the business owner can see what was actually wrong.

---

## 4. Phase 1 — The Traceability Backbone

This underpins everything else. Build it before the control features in Phase 2, because those features need to hang reference IDs off of something.

### Story 1.1 — Immutable Reference-ID Chain
As the Administrator, I need to trace any unit sold all the way back to the raw material it was made from, and any raw material forward to every unit it ended up in, so that recalls, disputes, and fraud investigations are a lookup, not an investigation.
- Every domain entity that represents a movement or transaction (`PurchaseOrder`, `ProductionBatch`, `WarehouseTransfer`, `RepStockIssue`, `SalesInvoice`, `Receipt`, `ReturnRequest`, `AdjustmentEntry`) gets an immutable, human-readable reference ID (existing convention: `PO-`, `BATCH-`, `TRF-`, `ISS-`, `INV-`, `REC-`) plus a foreign-key link to the record(s) that produced it.
- **No `UPDATE` on financial or movement history.** Corrections happen via a linked reversal/adjustment record that references the original. Enforce this at the repository layer (reject direct updates to confirmed records; expose an `adjust()` method instead that creates a new linked record).
- Build one query capability, exposed as a service method + UI screen: given any reference ID, walk the chain forward and backward (see the worked example in `Shield_Pro_Business_Process_Documentation.md` Section 4).

### Story 1.2 — Batch/Lot Numbering for Production & Raw Materials
As a QC/compliance-minded administrator, I need every production batch stamped with a lot number that links to the exact raw-material purchase lot(s) consumed, so that a defective raw material can be traced to every affected batch and every affected customer.
- Extend `ProductionBatch` domain entity with `rawMaterialLots: { purchaseOrderRef: string; quantityConsumed: number }[]`.
- Extend `PurchaseOrder`/`StockReceipt` with an optional `supplierLotNumber`.

**Definition of done:** given any `INV-xxxxx`, the system can render the full chain back to raw material purchase in under one query round-trip (or a small, bounded number of joins), and given any `PO-xxxxx` or `BATCH-xxxxx`, it can render everything downstream.

---

## 5. Phase 2 — Anti-Fraud & Anti-Human-Error Controls

This is the direct answer to "make it real, able to deal with human mistakes and human scams (more and more requests/approvals moving goods place to place, and manipulating caches/reports)."

### Story 2.1 — Segregation of Duties Enforcement
As the system, I must never let the same user both request and approve/confirm the same movement, so that a single compromised or dishonest account cannot move goods or money undetected.
- Add a `SegregationOfDutiesGuard` in `application/services/` that every approval-type service call must pass through: `requestedBy !== approvedBy`, `sentBy !== confirmedReceivedBy`, `soldBy !== cashUpConfirmedBy`, `purchaseEnteredBy !== paymentApprovedBy`.
- This guard should be a single reusable service/hook, not copy-pasted per module (Open/Closed Principle — new movement types plug into the same guard).
- Write unit tests that specifically try to violate each rule and confirm the guard blocks it.

### Story 2.2 — Tiered Auto-Approval Rules Engine
As the Administrator, I need routine, low-risk requests to auto-approve instantly, and only unusual/high-risk ones to reach my queue, so that I stop rubber-stamping everything and can actually pay attention to what matters.
- New `ApprovalRuleEngine` (Strategy pattern, consistent with existing architecture): configurable rules per movement type, e.g. "sub-warehouse stock issue to a rep, within their daily average × configurable multiplier → auto-approve," "same request type repeated more than N times in M hours for the same actor/item pair → force manual review regardless of size" (this specifically defeats the "many small requests to sneak past a size threshold" trick).
- Every rule evaluation is logged (who/what/when/rule-matched/outcome) — this log itself becomes an audit trail of what the system is auto-approving, so the Administrator can review the *rules'* behavior periodically, not just individual transactions.
- Administrator gets a dashboard of "exceptions needing attention" (built from the pending-manual-review queue), separate from a log of "auto-approved today" they can spot-check.

### Story 2.3 — Repeated-Movement / Round-Tripping Detection
As the Administrator, I need to be alerted if the same goods appear to be shuttling back and forth between warehouses/reps without a corresponding sale or legitimate reason, so that "moving goods place to place" can't be used to obscure shrinkage or timing fraud.
- Add a detection service (can start as a simple rule-based heuristic, not ML) that flags: the same item/quantity pattern transferred and reversed/re-requested more than N times in a rolling window; a rep whose stock-in-hand returns to a sub-warehouse and gets re-issued to the same rep repeatedly without intervening sales; unusually high ratio of adjustment/reversal entries relative to normal entries for a given user.
- Flags surface as alerts (Story 2.6) and appear on the Administrator's traceability dashboard, pre-filtered, not buried in the raw ledger.

### Story 2.4 — Sales Rep Stock-in-Hand & Cash-in-Hand Ledger
As a Sub-Warehouse Manager / Account Manager, I need every sales rep treated as a mini warehouse and mini cash register with a running balance, so that "issued − sold − returned" and "collected − handed in" are always visible and must equal zero at day's end.
- New domain entities: `RepStockLedger` (per rep, per item, running balance) and `RepCashLedger` (per rep, running balance, by payment type).
- Every stock issue, sale, return, and cash handover posts to these ledgers automatically — never manually edited.
- Mandatory **daily close-out** workflow: rep initiates close-out → system shows expected vs. actual (physical count + cash count entered by rep) → any variance requires Account Manager confirmation and is auto-flagged to the Administrator if outside tolerance. This is the single highest-value control per `Shield_Pro_Business_Process_Documentation.md` Section 5.3 — prioritize it.

### Story 2.5 — Credit Limits, Aging & Automatic Sales Blocking
As the Administrator, I need customers who exceed their credit limit or payment terms to be automatically blocked from further credit sales until I explicitly override it, so that reps can't quietly extend unlimited credit to move product.
- `Customer` entity: `creditLimit`, `paymentTermsDays`, computed `agingBuckets` (0-30/31-60/61-90/90+).
- Sale-creation service checks `outstandingBalance + newSaleAmount <= creditLimit` and blocks with a clear reason if exceeded; override requires Administrator action, logged with a reason (ties into Story 2.1's segregation rule: the rep who requested the override is never the one who grants it).

### Story 2.6 — Real-Time Alerts & Notification Layer
As any relevant role, I need to be pushed a notification rather than having to remember to check a report, so that low stock, pending approvals, overdue customers, missed cash-ups, unusual waste %, and fraud-detection flags (Story 2.3) reach the right person immediately.
- Build a lightweight `NotificationService` (Observer pattern, consistent with existing sync-subscriber pattern) with per-role subscription rules; deliver in-app first (toast + notification center), leave room for email/WhatsApp as a later channel (WhatsApp is already used for client_id sharing per `CRM_AUTHENTICATION_SETUP.md`, so infra precedent exists).

### Story 2.7 — QC Hold/Release for Production Batches
As Quality Control (or the Administrator acting as QC if no dedicated role exists yet), I need every production batch to sit in a "Pending QC" state before it becomes sellable stock, so that a bad batch is caught before it reaches a customer and there's a compliance record either way.
- Add `productionBatch.status: 'pending_qc' | 'released' | 'rejected'`; only `released` batches are visible/transferable to the Main Warehouse. Rejecting a batch requires a reason and routes to a disposal/rework flow (ties into Story 2.8).

### Story 2.8 — Returns, Damages & Write-off Workflow
As a Sub-Warehouse Manager or Sales Rep, I need a formal way to record customer returns and damaged stock, so that goods never simply "disappear" from the books.
- New `ReturnRequest` / `WriteOffRequest` entities, each requiring an approval step (segregation-of-duties applies: requester ≠ approver) and each posting a proper reversing/adjustment entry against the original chain (Story 1.1), never a direct stock edit.

### Story 2.9 — Physical Stock Count / Audit Module
As the Administrator, I need periodic physical counts compared against system-recorded stock, with a variance report, so that I have a real-world check on whether the traceability chain is actually matching reality.
- New `StockCountSession` workflow: initiate count for a warehouse → enter counted quantities per item → system computes variance vs. recorded stock → variances above tolerance require Administrator sign-off and generate an adjustment entry (Story 1.1) with the count session as its origin reference.

**Definition of done for Phase 2:** every story above has (a) unit tests proving the control actually blocks the bad path it's designed to block, (b) an audit_log entry for every state transition, (c) UI surfacing so the relevant role can see it without reading the database.

---

## 6. Phase 3 — CRM Authentication Hardening

`CRM_AUTHENTICATION_SETUP.md` documents a working but risky pattern: the client portal password is literally the `client_id`, and the `client_id` is the thing shared with the customer over WhatsApp/email as their "username." Anyone who intercepts or is shown the `client_id` has full login credentials — there is no actual secret.

### Story 3.1 — Add a Real Second Factor (Minimum Viable Fix)
As a customer, I should not be fully authenticated by something that is, by design, not secret.
- Options to evaluate with the business owner (present as options, don't unilaterally pick): (a) OTP sent via WhatsApp/SMS/email as a second step after `client_id` entry, (b) a separate, admin-set or self-set PIN in addition to `client_id`, (c) magic-link email as the primary factor with `client_id` as a lookup key only.
- Whichever is chosen, keep `client_id` as the human-friendly identifier/lookup key, but stop treating it as a password. Rotate all existing Supabase auth user passwords off the client_id value as part of migration.

### Story 3.2 — Revocation & Session Hardening
- Confirm `is_active = false` actually invalidates *existing* sessions, not just blocks new logins (check Supabase session handling — this is a common gap).
- Add rate-limiting / lockout on repeated failed client-portal login attempts (currently nothing in the docs suggests this exists).

### Story 3.3 — Admin Linking Workflow → Self-Service or Semi-Automated
- The current admin setup (`CRM_AUTHENTICATION_SETUP.md` Steps 1–4) is fully manual SQL. Wrap it in a proper admin UI action (`SalesService.linkCrmUserToCustomer()` already exists per the doc's "Added" section — verify it's actually wired to a UI, not just present in code) so this doesn't stay a runbook a human has to execute by hand in the Supabase SQL editor, which is itself an error-prone process worth eliminating.

---

## 7. Phase 4 — Reporting, Excel I/O, and Multi-Level Dashboards

### Story 4.1 — Standardize Excel Import/Export Contract
Define and implement exactly (per `Shield_Pro_Business_Process_Documentation.md` §6.9):
- **Export:** daily accounting report, customer statements, inventory valuation, production/waste report, P&L, rep cash-up report.
- **Import:** opening stock counts, supplier price lists, bank statements (for reconciliation against Story 0.3-hardened live data).
- One shared `ExcelIOService` (Facade pattern) rather than ad-hoc export buttons scattered per page.

### Story 4.2 — Multi-Level Reporting Cadence
Implement daily / weekly / monthly report generation jobs (cash position, sales, production output, waste %; rep performance, customer aging, stock movement; full P&L, inventory valuation, payroll cost, supplier performance) as described in `Shield_Pro_Business_Process_Documentation.md` §6.8. These read from the live ledgers built in Phase 1–2, not from ad-hoc cached aggregates (reinforces Story 0.3).

### Story 4.3 — Role-Scoped Data Visibility
Confirm and, where missing, enforce: each accountant/warehouse manager/sales rep sees only their own branch's data; the main warehouse manager and Administrator see everything. This should be enforced at the query/RLS layer (Supabase Row Level Security), not just hidden in the UI — a frontend-only restriction is not a security control.

---

## 8. Data Model Changes (Summary Checklist for Migrations)

- `customers`: `credit_limit`, `payment_terms_days` (if not present).
- `production_batches`: `status` enum (`pending_qc`/`released`/`rejected`), `raw_material_lots` linkage table.
- New tables: `rep_stock_ledger`, `rep_cash_ledger`, `rep_closeout_sessions`, `approval_rules`, `approval_rule_log`, `fraud_flags`, `return_requests`, `writeoff_requests`, `stock_count_sessions`, `notifications`.
- `customers`/`purchase_orders`/etc.: ensure every table involved in the reference chain has an immutable `reference_id` and `created_by`, plus `superseded_by`/`adjustment_of` nullable self-reference for the never-edit-history rule.
- CRM: migration to add whatever second-factor field Story 3.1 lands on (`otp_secret`, `pin_hash`, etc.), plus a migration to force-rotate existing auth passwords.

Each of these should be its own numbered migration file, following the existing convention, with a rollback and a checklist entry (mirroring the style already used in `CRM_AUTHENTICATION_SETUP.md`'s "Migration Checklist" section).

---

## 9. Non-Functional Requirements

- **Offline-first is non-negotiable.** Every new workflow (approval, ledger posting, QC hold, etc.) must work through the existing Dexie/sync pipeline — don't introduce a feature that only works online without an explicit, documented exception.
- **No feature regresses existing performance work** (pagination, virtual scrolling, lazy loading per `REFACTORING_GUIDE.md`) — new list views (approval queues, fraud flags, ledgers) must use the existing paginated/virtualized components, not a new one-off table.
- **RTL/Arabic support is preserved** for all new UI (the product is Arabic-first per `PROJECT_DOCUMENTATION.md`).
- **Every new service is unit-testable in isolation**, per the existing testing strategy (mock repositories for services, mock database for repositories).

---

## 10. Suggested Delivery Order

1. Phase 0 (Stabilization Audit) — do not skip, everything else builds on this.
2. Phase 1, Story 1.1–1.2 (Traceability backbone).
3. Phase 2, Story 2.4 (Rep stock/cash-in-hand + daily close-out) — highest fraud-prevention value per the business docs.
4. Phase 2, Story 2.1 (Segregation of duties guard) — cheap to build once 1.1 exists, huge leverage.
5. Phase 2, Story 2.2 + 2.3 (Approval tiers + round-tripping detection) — this is what actually stops the "many requests/approvals to shuffle goods" pattern.
6. Phase 2, Story 2.5 (Credit limits/aging).
7. Phase 3 (CRM auth hardening) — can be parallelized with the above since it's a mostly separate subsystem.
8. Phase 2, Story 2.7–2.9 (QC hold, returns/write-offs, stock count audit).
9. Phase 2, Story 2.6 (Notifications) — layer on top once there are meaningful events to notify about.
10. Phase 4 (Reporting/Excel/multi-level dashboards) — consumes everything built above, so it naturally comes last.

---

## 11. Definition of Done for the Whole Initiative

- Every story above is implemented, tested, and demoable independently.
- A single query on any invoice, batch, or transfer reference can walk the full chain forward and backward.
- No approval-type action can be requested and approved/confirmed by the same user.
- Every sales rep's stock and cash position is always reconcilable to zero at day's end, with variances flagged automatically.
- The Administrator's daily view is dominated by *exceptions*, not routine approvals.
- The CRM client portal no longer relies on a non-secret value as a password.
- No report or dashboard can show stale data after a mutation that should affect it.
- `PHASE_0_AUDIT_FINDINGS.md` plus per-phase `CHANGELOG` entries give the business owner a plain-language record of what was broken and what was fixed, in addition to the code itself.
