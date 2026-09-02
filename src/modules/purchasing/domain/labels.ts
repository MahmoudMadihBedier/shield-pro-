/**
 * Arabic-first (with English gloss) display strings for the `purchasing`
 * module. Presentation reads these so no screen hard-codes a label.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
export interface Label {
  ar: string
  en: string
}

export const PURCHASING_LABELS = {
  section: { ar: 'المشتريات', en: 'Purchasing' },
  purchaseOrder: {
    one: { ar: 'أمر شراء', en: 'Purchase order' },
    many: { ar: 'أوامر الشراء', en: 'Purchase orders' },
  },
  stockReceipt: {
    one: { ar: 'إذن استلام خامات', en: 'Raw-material receipt' },
    many: { ar: 'استلام الخامات', en: 'Raw-material receipts' },
  },
} as const

export const PO_FIELD_LABELS: Record<string, Label> = {
  reference_id: { ar: 'رقم المرجع', en: 'Reference' },
  supplier_id: { ar: 'المورد', en: 'Supplier' },
  total_value: { ar: 'الإجمالي', en: 'Total' },
  doc_status: { ar: 'الحالة', en: 'Status' },
  posting_datetime: { ar: 'تاريخ الترحيل', en: 'Posting date' },
  raw_material_id: { ar: 'الخامة', en: 'Raw material' },
  qty: { ar: 'الكمية', en: 'Qty' },
  unit_price: { ar: 'سعر الوحدة', en: 'Unit price' },
  line_total: { ar: 'إجمالي البند', en: 'Line total' },
}

export const RECEIPT_FIELD_LABELS: Record<string, Label> = {
  reference_id: { ar: 'رقم المرجع', en: 'Reference' },
  purchase_order_ref: { ar: 'أمر الشراء', en: 'Purchase order' },
  supplier_lot_number: { ar: 'رقم تشغيلة المورد', en: 'Supplier lot number' },
  doc_status: { ar: 'الحالة', en: 'Status' },
  posting_datetime: { ar: 'تاريخ الترحيل', en: 'Posting date' },
  raw_material_id: { ar: 'الخامة', en: 'Raw material' },
  qty: { ar: 'الكمية', en: 'Qty' },
  unit_price: { ar: 'سعر الوحدة', en: 'Unit price' },
  ordered: { ar: 'المطلوب', en: 'Ordered' },
  received: { ar: 'المستلم', en: 'Received' },
  remaining: { ar: 'المتبقي', en: 'Remaining' },
}

/** Convenience: `"عربي / English"`. */
export function bilingual(label: Label): string {
  return `${label.ar} / ${label.en}`
}
