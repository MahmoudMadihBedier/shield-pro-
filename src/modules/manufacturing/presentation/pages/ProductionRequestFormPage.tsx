/**
 * Create a production request. Product + planned quantity drive a live BOM
 * explosion; the exploded demand is frozen into `required_materials` on submit.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFormContext, useWatch } from 'react-hook-form'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { productBomRepo } from '@/modules/admin'
import { Form, FormError, NumberField, SelectField, type SelectOption } from '@/shared/forms'
import { Button, PageHeader } from '@/shared/ui'

import {
  requiredMaterialsFor,
  serializeRequiredMaterials,
} from '../../domain/planning'
import {
  productionRequestFormSchema,
  type ProductionRequestFormValues,
} from '../../domain/schemas'
import { BomExplosionPanel } from '../components/BomExplosionPanel'
import { useProductBom, useProductOptions, useRawMaterialOptions } from '../hooks/catalog'
import { useProductionRequestActions } from '../hooks/documents'

function BomPreview({ rawMaterialName }: { rawMaterialName: (id: string) => string }) {
  const { control } = useFormContext<ProductionRequestFormValues>()
  const productId = useWatch({ control, name: 'product_id' })
  const plannedQtyRaw = useWatch({ control, name: 'planned_qty' })
  const plannedQty = typeof plannedQtyRaw === 'number' ? plannedQtyRaw : Number.NaN
  const bom = useProductBom(productId || undefined)

  return (
    <BomExplosionPanel
      bomLines={bom.data ?? []}
      plannedQty={plannedQty}
      rawMaterialName={rawMaterialName}
      isLoading={Boolean(productId) && bom.isLoading}
      error={bom.isError ? bom.error : null}
    />
  )
}

export function ProductionRequestFormPage() {
  const navigate = useNavigate()
  const products = useProductOptions()
  const rawMaterials = useRawMaterialOptions()
  const { createDraft } = useProductionRequestActions()

  const productOptions = useMemo<SelectOption[]>(
    () => (products.data ?? []).map((p) => ({ value: p.$id, label: p.name })),
    [products.data],
  )

  const rawMaterialName = useMemo(() => {
    const map = new Map((rawMaterials.data ?? []).map((rm) => [rm.$id, rm.name]))
    return (id: string) => map.get(id) ?? id
  }, [rawMaterials.data])

  async function handleSubmit(values: ProductionRequestFormValues): Promise<Result<unknown>> {
    const bomResult = await productBomRepo.listForProduct(values.product_id)
    if (!bomResult.ok) return err(bomResult.error)

    const required = requiredMaterialsFor(bomResult.value.rows, values.planned_qty)

    try {
      const row = await createDraft.mutateAsync({
        fields: {
          product_id: values.product_id,
          planned_qty: values.planned_qty,
          required_materials: serializeRequiredMaterials(required),
          status: 'pending',
        },
      })
      navigate(`/manufacturing/requests/${row.$id}`)
      return ok(undefined)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        return err(error as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ الطلب. حاول مرة أخرى.'))
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="طلب إنتاج جديد"
        titleEn="New production request"
        actions={
          <Button variant="ghost" onClick={() => navigate('/manufacturing/requests')}>
            رجوع
          </Button>
        }
      />

      <Form
        schema={productionRequestFormSchema}
        defaultValues={{ product_id: '' }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {({ formError, isSubmitting }) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
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
              <NumberField
                name="planned_qty"
                label="الكمية المخططة"
                labelEn="Planned qty"
                required
                min={0}
              />
            </div>

            <BomPreview rawMaterialName={rawMaterialName} />

            <FormError message={formError} />

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'جارٍ الحفظ…' : 'إنشاء الطلب'}
              </Button>
            </div>
          </>
        )}
      </Form>
    </div>
  )
}
