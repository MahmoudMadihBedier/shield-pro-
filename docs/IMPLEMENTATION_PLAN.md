# Shield Pro — Implementation Plan

**Stack:** React 19 + TypeScript + Vite (SPA) · Appwrite (Cloud, Frankfurt) · Vercel
**Reference architecture:** [ERPNext](https://github.com/frappe/erpnext) — we mirror its
proven domain patterns (naming series, submittable documents, immutable ledgers,
workflow states, role + user-permission scoping).
**Source docs:** `SHIELD_PRO_REFACTOR_MASTER_PLAN.md`,
`Shield_Pro_Business_Process_Documentation.md`,
`نظام_ادارة_الانتاج_والتوزيع_والمبيعات.docx`, `دليل-استخدام-شيلد-برو.pdf`.

---

## 1. What the system is

One **closed loop**: raw material is purchased → manufactured into product →
distributed main warehouse → sub-warehouse → sales rep → sold to customer →
cash collected → returned to the main treasury. Every step is recorded, linked
to the step before and after it, and **no quantity or amount can appear or
disappear without a documented source and approval**.

Governing principles (from the `.docx`, §1):

1. **Quadruple step for every transfer** — request → approval → auto balance
   update → receipt confirmation.
2. **Custody balance** — every quantity leaving one custody enters another at
   equal value; "loss" exists only as a signed, approved waste/damage/return doc.
3. **Scoped visibility** — each user sees only their branch/reps/warehouse;
   System Admin, Main Warehouse Manager and Chief Accountant see everything.
4. **Price stability** — the admin-set selling price never changes directly; the
   only lever is a per-customer discount percentage.
5. **No deletion** — corrections are new reversing documents with a reason.
6. **Full backend linkage** — every operation reflects immediately in all
   related reports and balances, and notifies the System Admin.

---

## 2. Stack decisions & rationale

| Decision | Choice | Why |
| --- | --- | --- |
| Backend | **Appwrite fully replaces Supabase** | User directive. Databases + Auth + Functions + Realtime + Storage cover every need. `claude.md` Section C is being rewritten Supabase→Appwrite. |
| Frontend | **Vite SPA** (not Next.js) | Matches the existing baseline and the Appwrite React starter; deploys to Vercel as static + SPA rewrites. `claude.md`'s React Server Component rules do **not** apply. |
| Offline-first | **Dropped for v1** | Appwrite has no first-class offline sync. Online-only SPA is the fastest path to a deployed product. Revisit if the field-sales flow demands it (would be a Dexie cache + custom sync queue in the data layer). |
| Enforcement | **Appwrite Functions**, not client code | Segregation of duties, approval rules, ledger posting, sequence allocation and RBAC scope are all server-side. The client never writes a ledger row. |
| Security model | Collection permissions + Teams/labels + Function guards | Appwrite's equivalent of Postgres RLS. Ledgers and confirmed docs: **no client write permission at all**. |
| Schema management | `scripts/appwrite/provision.ts` (idempotent, `node-appwrite`) | Schema is code, never hand-edited in the console — the ERPNext-fixtures / Supabase-migrations equivalent. |

---

## 3. ERPNext → Shield Pro → Appwrite mapping

| Business concept (docs) | ERPNext analogue | Shield Pro collection | Notes |
| --- | --- | --- | --- |
| Product + recipe | Item + BOM | `products`, `product_bom` | BOM = grams/ml of each raw material per unit |
| Raw material | Item (`is_stock_item`, raw) | `raw_materials` | reorder point, supplier, purchase price |
| Customer + discount + credit limit | Customer + Customer Credit Limit | `customers` | discount %, `credit_limit`, `payment_terms_days`, geo, approval state |
| Supplier | Supplier | `suppliers` | |
| Branch | (Company / Cost Center) | `branches` | links sub-warehouse, branch accountant, reps |
| Warehouse & custody | Warehouse | `warehouses` | raw store, factory custody, main, sub, rep custody |
| Purchase | Purchase Order → Purchase Receipt | `purchase_orders`, `stock_receipts` | supplier lot number on receipt |
| Production request | Material Request (`Material Transfer for Manufacture`) | `production_requests` | factory → raw store |
| Manufacture | Work Order + Stock Entry (Manufacture) | `production_batches` | consumes raw lots, yields units + waste, **lot/batch number**, QC status |
| Warehouse transfer | Stock Entry (`Material Transfer`) / Delivery Note | `warehouse_transfers` | main↔sub, in-transit until confirmed |
| Rep stock issue | Stock Entry to a rep "warehouse" | `rep_stock_issues` | rep custody = a mobile warehouse |
| Sale | Sales Invoice (+ Delivery Note) | `sales_invoices` | serial numbered, timestamp + geolocation locked, payment method |
| Collection | Payment Entry (receive) | `receipts` | cash / bank / cheque, evidence attachment |
| Expense / supplier payment | Payment Entry (pay) / Journal Entry | `payment_vouchers` | mandatory reason |
| Returns / damage / write-off | Sales Return / Stock Entry (`Repack`/scrap) | `return_requests`, `write_offs` | own approval, posts reversing entries |
| Physical count | Stock Reconciliation | `stock_count_sessions` | variance → admin sign-off → adjustment |
| Rep daily cash-up | (POS closing) | `rep_closeouts` | issued = sold + returned + remaining; cash reconciled |
| Stock movement history | **Stock Ledger Entry** | `stock_ledger_entries` | append-only, `qty_after_transaction`, back-links voucher |
| Accounting | **GL Entry** (double entry) | `general_ledger_entries` | append-only |
| Per-item-per-warehouse balance | **Bin** | `bin_balances` | projection of the stock ledger; invalidated on every posting |
| Rep running balances | — | `rep_stock_ledger`, `rep_cash_ledger` | rep as mini-warehouse + mini-cash-register |
| Approvals | Workflow + Workflow State + Workflow Action | `approval_requests`, `approval_rules`, `approval_rule_log` | tiered auto-approve vs. escalate |
| Fraud heuristics | — | `fraud_flags` | round-tripping / repeated movement detection |
| Notifications | Notification Log | `notifications` | Realtime-delivered |
| Audit trail | Version / Activity | `audit_log` | every create/approve/reject/cancel |
| Naming series | Naming Series | `naming_series_counters` | atomic, gap-free, server-only |

---

## 4. Cross-cutting mechanisms (build once, in `core` + Functions)

These are the spine. Every module hangs off them.

### 4.1 Reference-ID chain — `src/core/reference-id.ts` ✅ scaffolded

`<PREFIX>-<YYYY>-<00000>` (e.g. `INV-2026-00042`). Prefix per entity
(`PO`, `BATCH`, `TRF`, `ISS`, `INV`, `REC`, `RET`, `WO`, `ADJ`, …). The sequence
is allocated by the `allocate-reference-id` Function against an atomic counter
row — never client-side, so a missing number is always a real red flag.

Each document stores the reference id of the record(s) that produced it, so the
`traceability` module can walk the chain **both directions** in a bounded number
of reads:

```
PO-2026-00001 → BATCH-2026-00005 → TRF-2026-00011 → ISS-2026-00023
             → INV-2026-00044 → REC-2026-00051
```

### 4.2 Document lifecycle — `src/core/doc-status.ts` ✅ scaffolded

ERPNext `docstatus`: `Draft(0) → Submitted(1) → Cancelled(2)`, two transitions
only. Submitted = immutable. A correction is an **amendment**: cancel, then a new
Draft with `amended_from` set. Enforced in the `submit-document` /
`cancel-document` Functions and by collection permissions (no `update` on a
submitted row).

### 4.3 Immutable ledgers

`stock_ledger_entries`, `general_ledger_entries`, `rep_stock_ledger`,
`rep_cash_ledger` are **append-only**, written **only** by Functions. Every row
carries `voucher_type` + `voucher_no` (the reference id) and a running
`*_after_transaction` balance. `bin_balances` is a fast projection, recomputed
and cache-busted on every posting — **no TTL-only invalidation for money or
stock** (Master Plan Story 0.3).

### 4.4 Segregation of duties — `segregation-guard` Function

`requestedBy !== approvedBy`, `sentBy !== confirmedReceivedBy`,
`soldBy !== cashUpConfirmedBy`, `purchaseEnteredBy !== paymentApprovedBy`.
One reusable guard; every submit path calls it. Unit tests try to violate each
rule.

### 4.5 Tiered approval engine — `approval-engine` Function

Rules per movement type in `approval_rules`: within rep daily-average × N →
auto-approve; same actor/item repeated > N times in M hours → force manual
review (defeats "many small requests" splitting); over credit limit / new
customer / price override → always manual. Every evaluation is logged to
`approval_rule_log`. Admin dashboard shows **exceptions**, not routine approvals.

### 4.6 RBAC + branch scope — `src/core/rbac.ts` ✅ scaffolded

11 roles from the `.docx` §2. `GLOBAL_SCOPE_ROLES` see everything; branch-scoped
roles see only their `branch_id`. UI hides/disables; Functions + collection
read-permissions enforce. Branch binding is set **only** by the System Admin.

### 4.7 Audit log

Every state-changing Function appends to `audit_log`
(`{actor, action, entity, ref, before, after, at}`). No exceptions — it is both a
compliance requirement and how we verify our own fixes.

---

## 5. Phased backlog

Phase 0 (Stabilization Audit) from the Master Plan is **N/A** — this is a
greenfield build, not a refactor of an existing codebase. Its *intent* (type
safety, one error contract, live-not-cached financial reads) is baked into the
architecture from the start.

### Phase 1 — Foundation & Traceability backbone

| Story | Deliverable |
| --- | --- |
| 1.0 | `scripts/appwrite/provision.ts` — create database, all tables, attributes, indexes, permissions, seed `naming_series_counters`. Idempotent. |
| 1.1 | Auth: staff login (Appwrite email/password), session bootstrap, `Principal` from teams + `branch_id`, route guards, role-aware nav. |
| 1.2 | `allocate-reference-id` + `submit-document` + `cancel-document` Functions; wire `core/doc-status` + `core/reference-id` to them. |
| 1.3 | `post-stock-ledger` + `post-gl` Functions; `bin_balances` projection + cache invalidation. |
| 1.4 | `traceability` module: chain-walker service + screen (given any ref id, render forward + backward); `audit_log` viewer. |
| 1.5 | `core/DataTable` (pagination, sort, filter, column config) + `core/formatters` ✅ + RTL layout shell + shared form kit (RHF + Zod resolver). |

**DoD:** given any `INV-xxxx` the full chain renders in a bounded number of
reads; no confirmed document is editable; `pnpm build/lint/test` green.

### Phase 2 — Anti-fraud & anti-error controls

| Story | Deliverable |
| --- | --- |
| 2.1 | `segregation-guard` Function + tests that try to break each rule. |
| 2.2 | `approval-engine` Function + `approval_rules` admin UI + exceptions dashboard + "auto-approved today" spot-check log. |
| 2.3 | `fraud-scan` Function (round-tripping / repeated-movement / high reversal-ratio heuristics) → `fraud_flags` on the admin dashboard. |
| 2.4 | **Rep stock + cash ledgers** and the mandatory **daily close-out** (`rep-closeout` Function): issued = sold + returned + remaining; cash reconciled; variance → Account Manager confirm + auto-flag to Admin. *Highest fraud-prevention value — prioritise.* |
| 2.5 | Credit limits + aging buckets (0-30/31-60/61-90/90+); sale-creation blocks when `outstanding + new > credit_limit`; Admin override, logged, SoD-checked. |
| 2.6 | `NotificationService` over Appwrite Realtime: low stock, pending approvals, overdue customers, missed cash-up, high waste %, fraud flags. In-app centre first; email/WhatsApp later. |
| 2.7 | QC hold/release: `production_batches.status = pending_qc | released | rejected`; only `released` is transferable; reject → reason → rework/disposal. |
| 2.8 | Returns / damages / write-offs: own approval (SoD), posts reversing entries against the original chain — never a direct stock edit. |
| 2.9 | Physical stock count: `stock_count_sessions` → variance vs. recorded → Admin sign-off → adjustment entry originating from the session. |

**DoD per story:** a test proving the control blocks its bad path; an
`audit_log` entry per transition; UI surfacing for the relevant role.

### Phase 3 — CRM client-portal auth hardening

The current design (per the Master Plan) makes the client's password *equal* to
their `client_id`, which is shared over WhatsApp — no real secret.

| Story | Deliverable |
| --- | --- |
| 3.1 | Real second factor — evaluate with owner: (a) OTP via WhatsApp/SMS/email, (b) admin/self-set PIN, (c) magic-link primary with `client_id` as lookup key only. Keep `client_id` as identifier, stop treating it as a password. |
| 3.2 | Revocation actually kills existing sessions (not just new logins); rate-limit + lockout on failed portal logins. |
| 3.3 | Admin "link CRM user ↔ customer" as a proper UI action (Appwrite Function), not a manual console runbook. |

### Phase 4 — Reporting, Excel I/O, dashboards

| Story | Deliverable |
| --- | --- |
| 4.1 | `ExcelIOService` (one Facade, not per-page buttons). **Export:** daily accounting report, customer statements, inventory valuation, production/waste, P&L, rep cash-up. **Import:** opening stock, supplier price lists, bank statements. |
| 4.2 | Daily / weekly / monthly report generation from the **live ledgers** (never ad-hoc cached aggregates). Cash position, sales, production output, waste %; rep performance, customer aging, stock movement; full P&L, inventory valuation, payroll cost, supplier performance. |
| 4.3 | Role-scoped data visibility enforced at the **query + permission** layer, not just hidden in the UI. |
| 4.4 | Admin dashboard: top/bottom products, branch & rep performance, gross margin, month sales trend, SLA-breached pending approvals, reorder-point alerts. |

### Later / optional (from `.docx` §11)

Allowed-waste threshold + alert, cheque register (in hand/deposited/cleared/
bounced), per-branch + main treasury accounts, approval SLA alerts, global
max-discount cap, data backup/restore runbook, dedicated mobile rep app for
mandatory geolocation.

---

## 6. Module delivery order

1. `admin` (master data: products, BOM, pricing, users, branches, warehouses) — everything else needs it
2. `purchasing` → `manufacturing` → `inventory` (the supply half of the loop + ledgers)
3. `sales` (rep issue, customer, invoice, pricing/discount) + `rep_closeouts`
4. `accounting` (GL, receipts, payment vouchers, credit/aging)
5. `traceability` (chain walker — usable as soon as Phase 1.4 lands, deepens as modules arrive)
6. `crm` (Phase 3, mostly independent — can parallelise)
7. `hr` (attendance, payroll, incentives)
8. Reporting / Excel / dashboards (Phase 4 — consumes everything above)

---

## 7. Testing strategy

- **Domain layer:** pure functions, no rendering — schema validation, approval
  rules, SoD checks, ledger math, aging buckets. One behaviour per test.
- **Data layer:** repositories tested against a mocked Appwrite client;
  error-mapping tested (see `infrastructure/appwrite/__tests__/errors.test.ts`).
- **Functions:** tested in isolation with fake context; every control has a test
  that feeds it the *bad* path and asserts a block.
- **Critical flows** need coverage before merge: invoicing, approvals, stock
  movement, rep close-out, credit checks, chain-walk.
- Deterministic only — no timing-dependent tests.

Commands: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build`.

---

## 8. Deployment

- **Frontend → Vercel.** Framework preset Vite; `vercel.json` sets
  `pnpm build` + SPA rewrites. Env vars `VITE_APPWRITE_*` are set in the Vercel
  project (or read from committed `.env`). Add the Vercel domain(s) as a **Web
  platform** in Appwrite so CORS allows the SDK.
- **Backend → Appwrite Cloud** (`shield-pro`, Frankfurt). Provision via
  `scripts/appwrite/provision.ts`. Functions deployed via Appwrite CLI /
  `appwrite deploy function` from `functions/`.
- **Secrets:** Appwrite API key (for provisioning + CI) in `.env.local` locally
  and Vercel/CI secrets — never committed, never in the bundle.

---

## 9. Open decisions

| # | Question | Owner |
| --- | --- | --- |
| D1 | CRM second factor: OTP vs. PIN vs. magic-link (Story 3.1) | Business owner |
| D2 | Global maximum discount cap value | Business owner |
| D3 | Rep daily-average multiplier for auto-approval; repeat-request N / window M | Business owner + eng |
| D4 | Cheque register in v1 or "later" bucket | Business owner |
| D5 | Do we need the offline-first field app before go-live, or after | Business owner |
| D6 | Fiscal calendar / year boundary for naming series reset | Accounting |

---

## 10. Status

**Scaffold:** Vite + TS + Appwrite SPA; validated env config; `client.ping()` at
startup + live connection indicator; Clean Architecture skeleton
(`core / infrastructure / application / presentation / shared` + `modules/*`);
`core` primitives (`Result`, `AppError`, `doc-status`, `reference-id`, `rbac`,
`principal`, `formatters`); error mapping; `vercel.json`; docs; `claude.md` on
Appwrite.

**Story 1.0 — done.** `scripts/appwrite/schema.ts` (33 tables, declarative) +
`scripts/appwrite/provision.ts` (idempotent runner: teams → database →
tables/columns/indexes → naming counters). `pnpm provision:dry` verified.

**Story 1.1 — in progress.** Auth data layer (`infrastructure/appwrite/auth.ts`:
login/logout/loadPrincipal → `Result`), `core/principal` (team ids → `Principal`),
`AuthProvider` + `useAuth` (TanStack Query session), `LoginPage` (RHF + Zod),
`RequireAuth` / `RequireRole` guards, `react-router` with lazy routes.
Remaining: run against a provisioned backend; role-aware nav; `branchId` set via
admin UI. 20 passing tests.

**Next:** finish 1.1 end-to-end once the backend is provisioned, then Story 1.2
(`allocate-reference-id` / `submit-document` / `cancel-document` Functions).
