# Shield Pro ERP — Business Process & User Workflow Documentation
### (Factory → Warehouse → Sub-Warehouse → Sales → Accounting → Administration)

---

## 1. Purpose of This Document

Your original documentation describes Shield Pro from a **technical** point of view (architecture, database, code). This document rewrites the same system from a **business operations** point of view: what each employee actually does, in what order, who must approve what, and how money and goods move through the company.

It is organized in three parts:

1. **Roles & Step-by-Step Workflows** — exactly what you described, written as detailed operating procedures.
2. **Money & Goods Control Framework** — cash, credit, deferred payments, bank transfers, and how the "back-linking" (full traceability) actually works in practice.
3. **Gap Analysis & Recommendations** — what is missing from the current design, and how to upgrade it into a professional, audit-proof system.

---

## 2. The Roles in the System

| Role | Also called | Core responsibility |
|---|---|---|
| **Production Operator** | Factory Worker | Records what was manufactured |
| **Main Warehouse Manager** | Central Warehouse | Receives finished goods, distributes to sub-warehouses |
| **Sub-Warehouse Manager** | Branch/Store Keeper | Receives stock from main warehouse, issues to sales reps |
| **Sales Representative** | Rep / Driver-Salesman | Sells to customers, collects money |
| **Account Manager** | Accountant | Monitors daily cash/credit movement, reconciles accounts |
| **System Administrator** | Owner / General Manager | Approves everything material, sets prices, sets discounts, owns the audit trail |

Every one of these roles is a **checkpoint**, not just a data-entry screen. The core design principle you asked for — "prevent discrepancies or loopholes" — comes from **no single role being able to move goods or money without a second role validating it.** This is called **segregation of duties**, and it's expanded in Section 5.

---

## 3. Detailed Step-by-Step Workflows

### 3.1 Production Operator — "What was made today"

1. **Select the product** to be manufactured (only products the Administrator has already defined — see 3.6).
2. **Enter the planned quantity** to be produced (e.g., 500 units of Sealant 500ml).
3. **Enter the actual quantity produced** once the batch is finished — this may differ from planned quantity due to spillage, rejects, or yield variance.
4. The system automatically calculates, using the recipe/BOM the Administrator defined:
   - **Raw materials required** (theoretical, based on recipe × planned quantity)
   - **Raw materials actually consumed** (based on what was pulled from the raw-material store — operator confirms or the system deducts automatically)
   - **Materials wasted/lost** = required − consumed − (variance explained by operator)
   - **Expected cost and expected profit** of this production run (cost of raw material + labor allocation, vs. selling price set by Administrator)
5. **Submit the production batch.** This creates a *pending transfer* — finished goods are not "in stock" yet; they sit in a **Production Holding Area** until:
   - Quality Control (recommended addition, see Section 6) signs off, and
   - The batch is formally transferred to the Main Warehouse.
6. Once transferred, the system generates a **batch/lot number** stamped on every unit — this is the anchor for all future traceability (a customer complaint six months later can be traced back to this exact batch, this exact raw-material delivery, and this exact operator/shift).
7. The **current inventory of produced products** becomes visible to the Main Warehouse Manager instantly.

> **Business logic to enforce:** the operator can *report* a quantity, but cannot *finalize* it into sellable stock alone — see the QC/Administrator checkpoint in Section 6.1.

---

### 3.2 Main Warehouse Manager — "What we have, and where it should go"

1. Sees the **live inventory** of finished goods transferred in from Production (by product, by batch, by expiry date).
2. Initiates a **distribution request**: choose sub-warehouse, choose product(s), choose quantity.
3. This request is **submitted for Administrator approval** — it does not move stock yet.
4. **Administrator approves or rejects** the distribution (with a reason if rejected — e.g., "that sub-warehouse hasn't settled last month's account").
5. Once approved, the Main Warehouse Manager executes the transfer:
   - System deducts the quantity from Main Warehouse stock.
   - A **Delivery Note / Stock Transfer document** is generated with a unique reference number.
   - The transfer is now "in transit" — not yet added to the sub-warehouse's confirmed stock.
6. Main Warehouse Manager can view an aging report of "goods sent but not yet confirmed received" to catch delivery discrepancies.

---

### 3.3 Sub-Warehouse Manager — "What actually arrived"

1. Receives a **notification** of incoming stock transfer with expected quantities.
2. Performs a **physical count on arrival** and enters actual received quantity per item.
3. Two paths:
   - **Match:** received quantity = sent quantity → Sub-warehouse manager **approves receipt** directly, and stock is confirmed into the sub-warehouse inventory.
   - **Mismatch (shortage/damage/overage):** Sub-warehouse manager **cannot silently adjust the number.** They must file a **discrepancy request**, which routes to the **System Administrator** for investigation and approval before the stock figure is finalized. This is the exact "approve or request approval from the main administrator" behavior you described — made explicit as a two-branch decision instead of one ambiguous action.
4. Once confirmed, sub-warehouse stock is now available for the Sales Representatives attached to that sub-warehouse.

---

### 3.4 Sales Representative — "Selling to the customer"

1. **Requests stock** from the Sub-Warehouse: selects product(s) and quantity needed for the day/route.
2. This request routes to the **System Administrator for approval** (as you specified). In practice this should have **two tiers** (see Section 6.2 — this is one of the gaps):
   - Small, routine, within-daily-limit requests → auto-approved instantly so the rep isn't blocked in the field.
   - Large or unusual requests → held for manual Administrator approval.
3. Once approved, stock is issued to the rep as a **"stock in hand" (van/route inventory)** — the rep is now personally accountable for these quantities until sold, returned, or accounted for.
4. **Creates a customer record** if new (name, contact, address, credit terms/limit — credit limit itself is set only by the Administrator, not the rep).
5. **Completes a sale**:
   - Selects customer, selects items and quantities from their stock-in-hand.
   - System applies the **fixed price set by the Administrator**, and automatically applies **any discount percentage the Administrator has pre-approved for that specific customer** — the rep cannot type in a custom price or discount.
   - Selects **payment method**: Cash / Credit (deferred) / Bank Transfer / Partial (split cash + credit).
   - If the sale amount + this customer's outstanding balance would exceed their **credit limit**, the system blocks the sale and requires **Administrator override approval**.
   - System generates the invoice, deducts from the rep's stock-in-hand, and — if cash was collected — adds it to the rep's **cash-in-hand ledger** (this is critical, see Section 5.3).
6. At **end of day/route**, the rep performs a **shift close / cash-up**:
   - System shows: opening stock, sold, returned, remaining stock, expected cash, expected credit issued.
   - Rep physically hands over cash and unsold stock to the Sub-Warehouse/Account Manager, who counts and confirms it.
   - Any variance (cash short/over, stock missing) is flagged automatically and reported to the Administrator — this is the anti-leakage control your business needs most, and it did not exist explicitly in the original design.

---

### 3.5 Account Manager — "Daily money supervision"

1. Reviews the **daily accounting report**, generated automatically at end of day, showing:
   - Cash collected per sales rep, per sub-warehouse
   - Credit (deferred) sales issued per customer, and aging (who owes what, since when)
   - Bank transfers received/reconciled against bank statements
   - Factory-side costs: raw materials purchased, wages, utilities, waste value
   - Expected vs. actual profit for the day, by product line
2. Reconciles rep cash-up sessions against the system's expected totals; flags variances.
3. Manages **accounts payable** (money the company owes suppliers) and **accounts receivable** (money customers owe the company), including overdue/aging alerts.
4. Prepares **daily, weekly, and monthly closing reports** for the Administrator.
5. Can **upload or reconcile bank statements** (imported as Excel/CSV) against system-recorded bank transactions to catch unrecorded fees, bounced payments, or missing entries.

---

### 3.6 System Administrator — "Owner-level control tower"

This role has exclusive, non-delegable authority over anything that affects **price integrity** and **traceability**:

1. **Product creation** — the only one who can define a new product: its raw materials, mixing/recipe ratios, packaging, and **selling price**. Nobody downstream can create a product or change its recipe/price.
2. **Price governance** — the price is locked. The *only* legitimate way to change what a customer pays is a **per-customer discount percentage**, set by the Administrator on the customer's profile, and applied automatically at the point of sale. This gives you pricing consistency across every rep and every sub-warehouse, while still allowing negotiated relationships with individual customers.
3. **Approvals** — every material movement (production→warehouse, warehouse→sub-warehouse, sub-warehouse→rep) and every large/unusual sale passes through Administrator approval (or a defined auto-approval rule the Administrator configures — see 6.2).
4. **Full traceability dashboard** — for any unit sold, the Administrator can trace it backward: which sales rep sold it → to which customer → from which sub-warehouse stock → from which main-warehouse transfer → from which production batch → made from which raw-material purchase lot. This "back-linking" is what prevents someone from quietly diverting stock or under-reporting sales.
5. **Reports** — daily/weekly/monthly dashboards on production, waste %, sales, profit margins by product, rep performance, customer aging, and cash position.
6. **Excel upload/export** — the Administrator can import external data (e.g., a supplier's price list, a bank statement, an opening stock count) as Excel, and export any report to Excel for offline analysis or sharing with auditors/investors.

---

## 4. How "Back-Linking" (Full Traceability) Actually Works

You asked for every part, detail, and transaction to be linked back to the Administrator to prevent loopholes. Concretely, this means every transaction in the system carries a **chain of reference IDs**, not just a description:

```
Raw Material Purchase (PO-00231, Supplier X)
      ↓
Production Batch (BATCH-00567) — consumed PO-00231, produced 500 units
      ↓
Warehouse Transfer (TRF-00891) — main warehouse → sub-warehouse "Cairo Branch"
      ↓
Rep Stock Issue (ISS-01123) — sub-warehouse → Rep "Ahmed", 50 units
      ↓
Sales Invoice (INV-04456) — Ahmed sold 10 units to Customer "Al-Nour Tires", credit
      ↓
Receipt/Collection (REC-00789) — cash collected against INV-04456, 15 days later
```

Every node in this chain is timestamped, attributed to a user, and immutable once confirmed (corrections happen via a linked reversal/adjustment entry, never by editing history — this is standard accounting practice and is what makes the system audit-proof).

The Administrator's dashboard should let them query this chain in **either direction**:
- Forward: "Batch 00567 — where did every unit end up, sold or unsold?"
- Backward: "Invoice 04456 — which raw material batch is this product made from?" (essential if a raw material is later found defective and needs recall).

---

## 5. Money & Goods Control Framework

### 5.1 Payment Types the System Must Distinguish

| Type | Description | Control needed |
|---|---|---|
| **Cash** | Paid on the spot | Must reconcile at rep's daily cash-up |
| **Credit (deferred)** | Customer pays later, on account | Needs credit limit, aging report, payment terms (e.g., Net 30) |
| **Bank Transfer** | Paid via bank, into company account | Needs bank reconciliation against actual bank statement |
| **Partial/Split** | Part cash, part credit | System splits automatically and tracks both halves |
| **Post-dated Cheque** (common in Egypt/MENA B2B) | Common deferred instrument | Needs a cheque register: due date, bank, status (in hand / deposited / cleared / bounced) |

### 5.2 Expense Types (Money Leaving the Business)

- **Cash expenses** (petty cash — fuel, minor repairs)
- **Credit purchases from suppliers** (accounts payable, with due dates)
- **Bank payments** (wire transfers, standing instructions — utilities, rent)
- **Payroll** (already in your original design)

### 5.3 Why "Rep Cash-in-Hand" Is the Most Important Missing Control

In a factory-to-field-sales business, the single biggest source of loss is **cash collected by reps but not fully handed in, or stock issued to reps but not fully sold/returned.** The system must therefore treat every sales rep as a **mini cash register and mini warehouse**, with:
- A running balance of stock-in-hand (issued − sold − returned = should be zero at day's end)
- A running balance of cash-in-hand (collected − handed in = should be zero at day's end)
- A **mandatory daily cash-up/close-out** that the Account Manager confirms, with automatic variance flags sent to the Administrator.

Without this, "back-linking" only tracks documents — it doesn't actually catch someone pocketing cash or quietly selling off-the-books.

---

## 6. Gap Analysis — What's Missing, and Recommended Additions

You asked me to think about what's been forgotten. Here is what a professional manufacturing/distribution ERP normally has that wasn't explicit in your description:

### 6.1 Quality Control (QC) Checkpoint
Right now, production output goes straight to warehouse. Add a **QC hold/release step**: newly produced batches sit in "Pending QC" until someone (QC role or Administrator) approves the batch quality — catches bad batches before they reach customers, and gives you a legal/compliance trail if a product is ever challenged.

### 6.2 Approval Tiers, Not a Single Bottleneck
If literally every stock request and every sale needs the Administrator's personal click, the Administrator becomes a bottleneck and will eventually just rubber-stamp everything (defeating the purpose). Recommendation: **rule-based auto-approval** for routine, within-limit transactions, and **manual approval only for exceptions** (over credit limit, unusually large quantity, new customer, price override request). The Administrator's dashboard should highlight only the exceptions that need attention.

### 6.3 Returns & Damages Workflow
What happens when a customer returns a product, or a sub-warehouse finds damaged stock? You need a formal **Return/Damage/Write-off process** with its own approval, so damaged goods don't just "disappear" from the books.

### 6.4 Stock Counting / Physical Inventory Audits
Periodic **physical stock counts** at each warehouse/sub-warehouse, compared against system-recorded stock, with variance reports to the Administrator — this is the real-world check on whether "back-linking" is actually working.

### 6.5 Supplier & Raw Material Traceability
Your description covers finished-goods traceability well, but for a chemical/tire-sealant factory, **raw material lot tracking** matters a lot (recalls, quality claims). Every raw material purchase should carry a supplier lot number that flows into the production batch record (this is already implied by your "back-linking" request — just making it explicit).

### 6.6 Credit Limits & Customer Risk Management
Beyond the discount percentage, each customer needs a **credit limit, payment terms, and an aging bucket (0-30 / 31-60 / 61-90 / 90+ days overdue)**, with automatic alerts to the Administrator and Account Manager when a customer is overdue — and automatic sales-blocking until they settle (with Administrator override capability).

### 6.7 Notifications & Alerts
Low stock at any warehouse level, pending approvals, overdue customers, rep cash-up not submitted, unusual waste percentage in production — all of these should push **real-time alerts** to the relevant role, not require someone to remember to check a report.

### 6.8 Multi-level Reporting Cadence
- **Daily**: cash position, sales, production output, waste %
- **Weekly**: rep performance, customer aging, stock movement summary
- **Monthly**: full P&L, inventory valuation, payroll cost, supplier performance

### 6.9 Excel Import/Export Standardization
Define exactly which reports/imports need Excel support:
- **Export**: daily accounting report, customer statements, inventory valuation, production/waste report, P&L
- **Import**: opening stock counts, supplier price lists, bank statements for reconciliation
This turns your "upload as Excel" request into a defined, testable feature rather than a vague capability.

### 6.10 Segregation of Duties (the real answer to "loopholes")
The strongest anti-fraud control isn't more approval clicks — it's making sure **the person who requests something is never the same person who approves or confirms it**. Concretely:
- The person recording production output ≠ the person confirming QC release.
- The person sending stock ≠ the person confirming receipt.
- The sales rep who sells ≠ the person who counts their cash-up.
- The person entering a purchase invoice ≠ the person approving supplier payment.

This single principle, applied consistently, is what actually prevents the discrepancies and loopholes you're worried about — more than any single "Administrator approves everything" button, which in practice becomes a formality once volume grows.

---

## 7. Suggested Priority Order for Building This

1. Core traceability chain (production → warehouse → sub-warehouse → rep → sale → payment), with immutable reference IDs.
2. Rep stock-in-hand and cash-in-hand tracking with mandatory daily close-out.
3. Credit limits, customer aging, and discount governance.
4. Approval-tier rules engine (auto-approve routine, escalate exceptions).
5. QC hold/release step for production batches.
6. Daily/weekly/monthly reporting suite with Excel export.
7. Returns/damages/write-off workflow.
8. Physical stock count / audit module.

---

## 8. Summary

Your original system already had the right instinct: **production feeds warehouse, warehouse feeds sub-warehouse, sub-warehouse feeds sales, and the Administrator sits above all of it with pricing and approval authority.** What turns this from a working prototype into a professional, audit-proof business system is:

- Making every handoff a **two-person checkpoint** (segregation of duties), not just a single approval click.
- Giving every sales rep a **personal accountability ledger** (stock-in-hand + cash-in-hand) with mandatory daily reconciliation.
- Making the **reference-ID chain** the backbone of every transaction, so anything can be traced forward or backward instantly.
- Separating **routine auto-approvals** from **exception-based manual approvals**, so the Administrator's attention goes where it's actually needed.
- Formalizing **credit, cash, bank, and cheque** as distinct payment types with their own controls, instead of treating "payment" as one generic field.
