# Business modules

Each module follows the Clean Architecture layering from `claude.md` Section B.3,
adapted for Appwrite:

```
modules/<name>/
  data/          Appwrite repositories: TablesDB rows, Functions calls, Storage,
                 Realtime subscriptions. Catches raw errors → returns Result<T, AppError>.
  domain/        Plain-TS business rules: Zod schemas, workflow/approval logic,
                 permission logic, calculations. ZERO framework imports. Use-cases
                 return Result<T, AppError> and never throw across a boundary.
  presentation/  Pages, components, hooks that consume domain/data. No business logic.
```

Anything reused by 2+ modules moves up to `src/core` (framework-free) or
`src/shared` (utils/config) — never duplicated per module.

## Modules

| Module          | Covers (from the business docs)                                              |
| --------------- | -------------------------------------------------------------------------- |
| `admin`         | Master data (products, BOM, pricing, users, branches), approvals inbox     |
| `purchasing`    | Suppliers, purchase orders, raw-material receipts                          |
| `manufacturing` | Production requests, BOM consumption, batches, QC hold/release, waste      |
| `inventory`     | Warehouses, transfers, receipts, stock ledger, bin balances, stock counts |
| `sales`         | Rep stock issue, customers, invoicing, pricing/discount, rep cash-up       |
| `accounting`    | GL entries, receipts/payment vouchers, credit limits + aging, reconciliation |
| `hr`            | Attendance, job grade, payroll, incentives/deductions                     |
| `crm`           | Client portal auth (hardened), customer self-service                      |
| `traceability`  | Reference-ID chain walker (forward/backward), audit log viewer            |

Delivery order is in `docs/IMPLEMENTATION_PLAN.md`.
