/**
 * Bulk data-import screen (Plan §4.1). Each importer is a `<CsvImportPanel>`
 * with its own Zod row schema + commit call. Starts with the supplier price
 * list; opening stock / bank statements slot in the same way.
 */
import { z } from 'zod'

import { CsvImportPanel } from '@/shared/excel'
import { PageHeader } from '@/shared/ui'

import { importRawMaterialPrices } from '../../data/imports'

const priceRowSchema = z.object({
  code: z.string().trim().min(1, 'code مطلوب'),
  purchase_price: z.coerce
    .number({ error: 'purchase_price يجب أن يكون رقمًا' })
    .nonnegative('purchase_price يجب ألا يكون سالبًا'),
})
type PriceRow = z.infer<typeof priceRowSchema>

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
    </div>
  )
}
