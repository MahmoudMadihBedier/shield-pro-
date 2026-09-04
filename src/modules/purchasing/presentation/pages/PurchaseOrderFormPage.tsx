/**
 * Create / edit form for a purchase-order Draft. Rendered inside a dialog from
 * the list and detail pages. Uses the shared RHF + Zod form kit only.
 */
import type { DefaultValues } from 'react-hook-form'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { Form, FormError, SelectField } from '@/shared/forms'
import { Button } from '@/shared/ui'

import { parsePoLines, poTotal, serializeLines } from '../../domain/lines'
import { PO_FIELD_LABELS } from '../../domain/labels'
import {
  purchaseOrderFormSchema,
  type PurchaseOrder,
  type PurchaseOrderForm as PurchaseOrderFormValues,
} from '../../domain/schemas'
import { PoLineEditor } from '../components/PoLineEditor'
import { EMPTY_PO_LINE } from '../components/line-defaults'
import { usePurchaseOrderActions } from '../hooks/usePurchaseOrders'
import { useRawMaterialOptions, useSupplierOptions } from '../hooks/usePickerOptions'

export interface PurchaseOrderFormPageProps {
  mode: 'create' | 'edit'
  order?: PurchaseOrder
  onDone: () => void
}

export function PurchaseOrderFormPage({ mode, order, onDone }: PurchaseOrderFormPageProps) {
  const suppliers = useSupplierOptions()
  const rawMaterials = useRawMaterialOptions()
  const actions = usePurchaseOrderActions()

  const existingLines = order ? parsePoLines(order.lines) : []
  const defaults: PurchaseOrderFormValues = {
    supplier_id: order?.supplier_id ?? '',
    lines: existingLines.length > 0 ? existingLines : [{ ...EMPTY_PO_LINE }],
  }

  async function handleSubmit(values: PurchaseOrderFormValues): Promise<Result<unknown>> {
    const payload = {
      supplier_id: values.supplier_id,
      lines: serializeLines(values.lines),
      total_value: poTotal(values.lines),
    }
    try {
      if (mode === 'create') {
        await actions.createDraft(payload)
      } else if (order) {
        await actions.updateDraft(order.$id, payload)
      }
      onDone()
      return ok(undefined)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        return err(error as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ أمر الشراء. حاول مرة أخرى.'))
    }
  }

  return (
    <Form
      schema={purchaseOrderFormSchema}
      defaultValues={defaults as DefaultValues<PurchaseOrderFormValues>}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {({ formError, isSubmitting }) => (
        <>
          <SelectField
            name="supplier_id"
            label={PO_FIELD_LABELS.supplier_id!.ar}
            labelEn={PO_FIELD_LABELS.supplier_id!.en}
            required
            options={suppliers.data ?? []}
            placeholder={
              suppliers.isError
                ? 'تعذّر تحميل الموردين'
                : suppliers.isLoading
                  ? 'جارٍ التحميل…'
                  : 'اختر المورد…'
            }
          />

          {rawMaterials.isError ? (
            <p className="text-xs text-red-600 dark:text-red-400">تعذّر تحميل قائمة الخامات.</p>
          ) : (
            <PoLineEditor
              rawMaterialOptions={rawMaterials.data ?? []}
              disabled={rawMaterials.isLoading}
            />
          )}

          <FormError message={formError} />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onDone} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting || actions.isPending}>
              {isSubmitting ? 'جارٍ الحفظ…' : mode === 'create' ? 'إنشاء مسودة' : 'حفظ'}
            </Button>
          </div>
        </>
      )}
    </Form>
  )
}
