/**
 * Arabic-first display labels for the document tables that appear in a
 * traceability chain. Keyed by table id (the `entityType` on a `ChainNode`).
 *
 * `domain` has ZERO framework imports — plain TypeScript only.
 */

export interface EntityLabel {
  ar: string
  en: string
}

export const ENTITY_LABELS: Record<string, EntityLabel> = {
  purchase_orders: { ar: 'أمر شراء', en: 'Purchase order' },
  stock_receipts: { ar: 'إذن استلام خامات', en: 'Raw-material receipt' },
  production_requests: { ar: 'طلب إنتاج', en: 'Production request' },
  production_batches: { ar: 'تشغيلة إنتاج', en: 'Production batch' },
  warehouse_transfers: { ar: 'تحويل مخزني', en: 'Warehouse transfer' },
  rep_stock_issues: { ar: 'صرف بضاعة لمندوب', en: 'Rep stock issue' },
  sales_invoices: { ar: 'فاتورة مبيعات', en: 'Sales invoice' },
  receipts: { ar: 'سند تحصيل', en: 'Collection / receipt' },
  payment_vouchers: { ar: 'سند صرف', en: 'Payment voucher' },
  return_requests: { ar: 'طلب مرتجع', en: 'Return request' },
  write_offs: { ar: 'إذن إعدام / هالك', en: 'Write-off / damage' },
  stock_count_sessions: { ar: 'جلسة جرد', en: 'Stock count session' },
  rep_closeouts: { ar: 'تقفيل يومي لمندوب', en: 'Rep daily close-out' },
  payroll_runs: { ar: 'صرف رواتب', en: 'Payroll run' },
}

/** Label for an entity type, falling back to the raw id if it is unknown. */
export function entityLabel(entityType: string): EntityLabel {
  return ENTITY_LABELS[entityType] ?? { ar: entityType, en: entityType }
}
