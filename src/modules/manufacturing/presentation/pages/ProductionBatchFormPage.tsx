/**
 * Create a production batch (work order). May start from an `issued` production
 * request (`?requestRef=PR-…`) or stand alone. Shows a live waste-allowance
 * check and a live expected cost / profit while the form is filled in; the
 * authoritative figures are recomputed by the enforcing Function at submit time.
 */
import { useMemo, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { formatCurrency, formatPercent } from '@/shared/formatters'
import { Form, FormError, NumberField, SelectField, TextField, type SelectOption } from '@/shared/forms'
import { Button, Card, PageHeader } from '@/shared/ui'

import {
  expectedCost,
  expectedProfit,
  wasteRatio,
  wasteWithinAllowance,
} from '../../domain/costing'
import { serializeRawMaterialLots } from '../../domain/planning'
import {
  productionBatchFormSchema,
  rawMaterialLotSchema,
  type ProductionBatchFormValues,
  type RawMaterialLot,
} from '../../domain/schemas'
import { RawLotConsumptionEditor } from '../components/RawLotConsumptionEditor'
import { useProductOptions, useRawMaterialOptions } from '../hooks/catalog'
import { useProductionBatchActions } from '../hooks/documents'
import { rawLotRowsToLots, type RawLotDraftRow } from '../raw-lot-rows'

const lotsArraySchema = z.array(rawMaterialLotSchema)

/**
 * Live cost/waste read-out. `rawPriceById` would key on
 * `raw_material_lots[].purchase_order_ref`; there is no client-side PO price
 * source in this build, so it is empty and `expectedCost` returns 0 until the
 * Function costs the batch. `expected_profit` still reflects revenue at
 * `product.base_price`.
 */
function BatchPreview({
  rows,
  productOptions,
  products,
}: {
  rows: RawLotDraftRow[]
  productOptions: SelectOption[]
  products: ReturnType<typeof useProductOptions>['data']
}) {
  const { control } = useFormContext<ProductionBatchFormValues>()
  const productId = useWatch({ control, name: 'product_id' })
  const producedRaw = useWatch({ control, name: 'produced_qty' })
  const wasteRaw = useWatch({ control, name: 'waste_qty' })

  const produced = typeof producedRaw === 'number' && Number.isFinite(producedRaw) ? producedRaw : 0
  const waste = typeof wasteRaw === 'number' && Number.isFinite(wasteRaw) ? wasteRaw : 0
  const product = (products ?? []).find((p) => p.$id === productId) ?? null

  const lots = rawLotRowsToLots(rows).filter(
    (lot) => lot.purchase_order_ref !== '' && Number.isFinite(lot.qty_consumed) && lot.qty_consumed > 0,
  )
  const cost = expectedCost(lots, new Map<string, number>())
  const profit = expectedProfit(produced, product?.base_price ?? 0, cost)
  const ratio = wasteRatio(produced, waste)
  const allowedPct = product?.allowed_waste_pct ?? 0
  const within = wasteWithinAllowance(ratio, allowedPct)

  const knownCount = productOptions.length

  return (
    <Card className="space-y-2 text-sm">
      <h3 className="font-semibold">تقدير التكلفة والهالك / Live estimate</h3>
      <div className="flex justify-between">
        <span className="text-zinc-500">التكلفة المتوقعة</span>
        <span dir="ltr">{formatCurrency(cost)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-zinc-500">الربح المتوقع</span>
        <span dir="ltr">{formatCurrency(profit)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-zinc-500">نسبة الهالك</span>
        <span dir="ltr">
          {formatPercent(ratio)} / حد {formatPercent(allowedPct / 100)}
        </span>
      </div>
      {!within ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          نسبة الهالك تتجاوز الحد المسموح به لهذا المنتج.
        </p>
      ) : null}
      {knownCount === 0 ? (
        <p className="text-xs text-zinc-400">لا توجد منتجات مُحمّلة بعد.</p>
      ) : null}
    </Card>
  )
}

export function ProductionBatchFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestRef = searchParams.get('requestRef') ?? ''

  const products = useProductOptions()
  const rawMaterials = useRawMaterialOptions()
  const { createDraft } = useProductionBatchActions()
  const [rows, setRows] = useState<RawLotDraftRow[]>([])
  const [rowsError, setRowsError] = useState<string | null>(null)

  const productOptions = useMemo<SelectOption[]>(
    () => (products.data ?? []).map((p) => ({ value: p.$id, label: p.name })),
    [products.data],
  )

  async function handleSubmit(values: ProductionBatchFormValues): Promise<Result<unknown>> {
    setRowsError(null)
    const parsedLots = lotsArraySchema.safeParse(rawLotRowsToLots(rows))
    if (!parsedLots.success) {
      setRowsError('تحقق من أسطر الخامات المستهلكة — كل سطر يحتاج مرجع أمر شراء وكمية أكبر من صفر.')
      return err(appError('validation', 'أسطر الخامات المستهلكة غير صالحة.'))
    }
    const lots: RawMaterialLot[] = parsedLots.data

    const product = (products.data ?? []).find((p) => p.$id === values.product_id) ?? null
    const cost = expectedCost(lots, new Map<string, number>())
    const profit = expectedProfit(values.produced_qty, product?.base_price ?? 0, cost)

    try {
      const row = await createDraft.mutateAsync({
        fields: {
          production_request_ref: values.production_request_ref || undefined,
          product_id: values.product_id,
          lot_number: values.lot_number,
          produced_qty: values.produced_qty,
          waste_qty: values.waste_qty,
          raw_material_lots: serializeRawMaterialLots(lots),
          expected_cost: cost,
          expected_profit: profit,
          expiry_date: values.expiry_date || undefined,
        },
      })
      navigate(`/manufacturing/batches/${row.$id}`)
      return ok(undefined)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        return err(error as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ أمر التشغيل. حاول مرة أخرى.'))
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="أمر تشغيل جديد"
        titleEn="New production batch"
        actions={
          <Button variant="ghost" onClick={() => navigate('/manufacturing/batches')}>
            رجوع
          </Button>
        }
      />

      <Form
        schema={productionBatchFormSchema}
        defaultValues={{
          production_request_ref: requestRef,
          product_id: '',
          lot_number: '',
          expiry_date: '',
        }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {({ formError, isSubmitting }) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                name="production_request_ref"
                label="مرجع طلب الإنتاج"
                labelEn="Production request ref"
                hint="اختياري — اتركه فارغًا لأمر تشغيل مستقل"
              />
              <SelectField
                name="product_id"
                label="المنتج"
                labelEn="Product"
                required
                options={productOptions}
                placeholder={
                  products.isLoading
                    ? 'جارٍ التحميل…'
                    : products.isError
                      ? 'تعذّر تحميل المنتجات'
                      : 'اختر المنتج'
                }
              />
              <TextField name="lot_number" label="رقم التشغيلة" labelEn="Lot number" required />
              <NumberField name="produced_qty" label="الكمية المنتجة" labelEn="Produced qty" required min={0} />
              <NumberField name="waste_qty" label="كمية الهالك" labelEn="Waste qty" min={0} />
              <TextField name="expiry_date" label="تاريخ الانتهاء" labelEn="Expiry date" type="text" hint="مثال: 2027-01-31" />
            </div>

            <RawLotConsumptionEditor rows={rows} onChange={setRows} disabled={isSubmitting} />
            {rowsError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {rowsError}
              </p>
            ) : null}

            <BatchPreview rows={rows} productOptions={productOptions} products={products.data} />
            {rawMaterials.isError ? (
              <p className="text-xs text-amber-600">تعذّر تحميل أسماء الخامات.</p>
            ) : null}

            <FormError message={formError} />

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'جارٍ الحفظ…' : 'إنشاء أمر التشغيل'}
              </Button>
            </div>
          </>
        )}
      </Form>
    </div>
  )
}
