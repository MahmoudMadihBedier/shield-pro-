/**
 * A return can reverse a sale, a warehouse transfer, or a raw-material
 * receipt (`docs/IMPLEMENTATION_PLAN.md` §3, `traceability/domain/link-fields`
 * — `return_requests.origin_ref` → `sales_invoices` / `warehouse_transfers`).
 *
 * This module reads the `origin_ref`'s reference-id prefix ONLY — it never
 * imports `@/modules/sales` or `@/modules/inventory` — so the `returns` module
 * stays decoupled from where the goods actually came from.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import { parseReferenceId, REFERENCE_PREFIXES } from '@/core/reference-id'

export type OriginKind = 'sale' | 'transfer' | 'receipt' | 'unknown'

/** Which kind of document `originRef` reverses, from its reference-id prefix alone. */
export function originKind(originRef: string): OriginKind {
  const parsed = parseReferenceId(originRef)
  if (!parsed) return 'unknown'
  switch (parsed.prefix) {
    case REFERENCE_PREFIXES.SalesInvoice:
      return 'sale'
    case REFERENCE_PREFIXES.WarehouseTransfer:
      return 'transfer'
    case REFERENCE_PREFIXES.StockReceipt:
      return 'receipt'
    default:
      return 'unknown'
  }
}

/**
 * UI guidance only — a human hint for which warehouse a return of this kind
 * should land back in. The actual warehouse is always chosen by the user in
 * the form; this never drives a business decision on its own.
 */
export function originWarehouseHint(kind: OriginKind): string {
  switch (kind) {
    case 'sale':
      return 'عهدة المندوب / المخزن الرئيسي — Rep or main custody warehouse'
    case 'transfer':
      return 'مخزن وجهة التحويل — the transfer’s destination warehouse'
    case 'receipt':
      return 'مخزن الخامات — the raw-material store'
    case 'unknown':
      return 'اختر المخزن المناسب يدويًا — pick the right warehouse manually'
  }
}
