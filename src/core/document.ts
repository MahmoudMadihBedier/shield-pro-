/**
 * Which business documents have an ERPNext-style lifecycle, and the shape of the
 * envelope every one of them carries. Shared by the Appwrite Functions that move
 * documents between states and by the client data layer that calls them.
 *
 * The table-id strings here mirror `src/infrastructure/appwrite/collections.ts`
 * (`Tables`) and `scripts/appwrite/schema.ts`. A drift guard in
 * `__tests__/document.test.ts` fails if they ever disagree.
 *
 * `core` has ZERO framework imports — plain TypeScript only (Zod is allowed;
 * it is the project's runtime-validation primitive, see `shared/config.ts`).
 */
import { z } from 'zod'

import { DocStatus } from './doc-status'
import type { ReferenceEntity } from './reference-id'

/**
 * Tables whose rows are submittable documents (`doc(...)` in `schema.ts`):
 * created as a Draft by the client, then advanced only by the
 * `submit-document` / `cancel-document` Functions.
 */
export const SUBMITTABLE_DOC_TABLES = [
  'purchase_orders',
  'stock_receipts',
  'production_requests',
  'production_batches',
  'warehouse_transfers',
  'rep_stock_issues',
  'sales_invoices',
  'receipts',
  'payment_vouchers',
  'return_requests',
  'write_offs',
  'stock_count_sessions',
  'rep_closeouts',
  'payroll_runs',
] as const

export type SubmittableDocTable = (typeof SUBMITTABLE_DOC_TABLES)[number]

const SUBMITTABLE_SET: ReadonlySet<string> = new Set(SUBMITTABLE_DOC_TABLES)

export function isSubmittableDocTable(table: string): table is SubmittableDocTable {
  return SUBMITTABLE_SET.has(table)
}

/**
 * The `reference-id` entity that names each submittable document table — the
 * key passed to `/allocate-reference-id`. Keys are a subset of
 * `REFERENCE_PREFIXES`; the ledger / adjustment entities are excluded because
 * they are Function-written, never client drafts.
 */
export const SUBMITTABLE_ENTITY_TABLE = {
  PurchaseOrder: 'purchase_orders',
  StockReceipt: 'stock_receipts',
  ProductionRequest: 'production_requests',
  ProductionBatch: 'production_batches',
  WarehouseTransfer: 'warehouse_transfers',
  RepStockIssue: 'rep_stock_issues',
  SalesInvoice: 'sales_invoices',
  Receipt: 'receipts',
  PaymentVoucher: 'payment_vouchers',
  ReturnRequest: 'return_requests',
  WriteOff: 'write_offs',
  StockCountSession: 'stock_count_sessions',
  RepCloseout: 'rep_closeouts',
  PayrollRun: 'payroll_runs',
} as const satisfies Record<string, SubmittableDocTable>

export type SubmittableEntity = keyof typeof SUBMITTABLE_ENTITY_TABLE

const TABLE_BY_ENTITY = SUBMITTABLE_ENTITY_TABLE as Record<SubmittableEntity, SubmittableDocTable>
const ENTITY_BY_TABLE = Object.fromEntries(
  Object.entries(SUBMITTABLE_ENTITY_TABLE).map(([entity, table]) => [table, entity]),
) as Record<SubmittableDocTable, SubmittableEntity>

export function tableForEntity(entity: SubmittableEntity): SubmittableDocTable {
  return TABLE_BY_ENTITY[entity]
}

export function entityForTable(table: SubmittableDocTable): SubmittableEntity {
  return ENTITY_BY_TABLE[table]
}

/**
 * Every submittable entity, typed as `ReferenceEntity` so a mismatch with
 * `REFERENCE_PREFIXES` is a compile error.
 */
export const SUBMITTABLE_ENTITIES: ReadonlyArray<ReferenceEntity & SubmittableEntity> =
  Object.keys(SUBMITTABLE_ENTITY_TABLE) as Array<ReferenceEntity & SubmittableEntity>

/**
 * The columns `documentEnvelope` adds to every submittable table in
 * `schema.ts`. Parsed defensively at the Function boundary — an Appwrite row is
 * an untyped `Record` until it clears this.
 */
export const documentEnvelopeSchema = z.object({
  reference_id: z.string().min(1).max(32),
  doc_status: z
    .number()
    .int()
    .refine(
      (v): v is DocStatus => v === DocStatus.Draft || v === DocStatus.Submitted || v === DocStatus.Cancelled,
      { message: 'doc_status must be 0 (Draft), 1 (Submitted) or 2 (Cancelled)' },
    ),
  branch_id: z.string().max(36).optional().nullable(),
  created_by: z.string().min(1).max(36),
  amended_from: z.string().max(32).optional().nullable(),
  posting_datetime: z.string(),
  remarks: z.string().max(2000).optional().nullable(),
})

export type DocumentEnvelope = z.infer<typeof documentEnvelopeSchema>
