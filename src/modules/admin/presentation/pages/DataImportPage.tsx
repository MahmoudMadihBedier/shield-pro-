/**
 * Bulk data-import screen (Plan §4.1). Each importer is a `<CsvImportPanel>`
 * with its own Zod row schema + commit call: supplier price list, opening
 * stock (posts a real stock-ledger move, never a direct `bin_balances`
 * write), and the bank statement (reconciled from `/accounting/bank-statement`).
 */
import { z } from 'zod'

import {
  bankStatementImportRowSchema,
  type BankStatementImportRow,
} from '@/modules/accounting/domain/bank-statement'
import { CsvImportPanel } from '@/shared/excel'
import { PageHeader } from '@/shared/ui'

import { importBankStatement, importOpeningStock, importRawMaterialPrices } from '../../data/imports'

const priceRowSchema = z.object({
  code: z.string().trim().min(1, 'code مطلوب'),
  purchase_price: z.coerce
    .number({ error: 'purchase_price يجب أن يكون رقمًا' })
    .nonnegative('purchase_price يجب ألا يكون سالبًا'),
})
type PriceRow = z.infer<typeof priceRowSchema>

const openingStockRowSchema = z.object({
  product_code: z.string().trim().min(1, 'product_code مطلوب'),
  warehouse_name: z.string().trim().min(1, 'warehouse_name مطلوب'),
  qty: z.coerce.number({ error: 'qty يجب أن يكون رقمًا' }).positive('qty يجب أن يكون أكبر من صفر'),
  unit_cost: z.coerce
    .number({ error: 'unit_cost يجب أن يكون رقمًا' })
    .nonnegative('unit_cost يجب ألا يكون سالبًا'),
})
type OpeningStockRow = z.infer<typeof openingStockRowSchema>

export function DataImportPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="استيراد البيانات"
        titleEn="Data import"
        description="رفع قوائم بصيغة CSV. تُحدَّث السجلات بمطابقة الرمز (code)."
      />

      <CsvImportPanel<PriceRow>
        title="قائمة أسعار الموردين / Supplier price list"
        templateHeaders={['code', 'purchase_price']}
        rowSchema={priceRowSchema}
        onCommit={async (rows) => {
          const res = await importRawMaterialPrices(rows)
          if (!res.ok) throw new Error(res.error.message)
          return {
            applied: res.value.applied,
            skipped: res.value.skipped,
            message:
              res.value.missing.length > 0
                ? `رموز غير معروفة: ${res.value.missing.join(', ')}`
                : undefined,
          }
        }}
      />

      <CsvImportPanel<OpeningStockRow>
        title="الرصيد الافتتاحي للمخزون / Opening stock"
        templateHeaders={['product_code', 'warehouse_name', 'qty', 'unit_cost']}
        rowSchema={openingStockRowSchema}
        onCommit={async (rows) => {
          const res = await importOpeningStock(rows)
          if (!res.ok) throw new Error(res.error.message)
          return {
            applied: res.value.applied,
            skipped: res.value.skipped,
            message:
              res.value.errors.length > 0
                ? res.value.errors.join(' — ')
                : res.value.voucherNo
                  ? `المستند: ${res.value.voucherNo}`
                  : undefined,
          }
        }}
      />

      <CsvImportPanel<BankStatementImportRow>
        title="كشف الحساب البنكي / Bank statement"
        templateHeaders={['statement_date', 'description', 'reference', 'debit', 'credit', 'balance']}
        rowSchema={bankStatementImportRowSchema}
        onCommit={async (rows) => {
          const res = await importBankStatement(rows)
          if (!res.ok) throw new Error(res.error.message)
          return {
            applied: res.value.applied,
            skipped: res.value.skipped,
            message: res.value.batchRef ? `الدفعة: ${res.value.batchRef}` : undefined,
          }
        }}
      />
    </div>
  )
}
