/**
 * Create form for a stock-receipt Draft. The user picks a **Submitted** purchase
 * order; its lines pre-fill the receipt editor, which shows an
 * ordered / received / remaining reconciliation and blocks a save that would
 * over-receive.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFormContext, useWatch, type DefaultValues } from 'react-hook-form'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { Form, FormError, SelectField, TextField } from '@/shared/forms'
import { Button } from '@/shared/ui'

import { parsePoLines, receivedVsOrdered, serializeLines } from '../../domain/lines'
import { RECEIPT_FIELD_LABELS } from '../../domain/labels'
import {
  stockReceiptFormSchema,
  type PurchaseOrder,
  type StockReceiptForm as StockReceiptFormValues,
} from '../../domain/schemas'
import { ReceiptLineEditor } from '../components/ReceiptLineEditor'
import { EMPTY_RECEIPT_LINE } from '../components/line-defaults'
import { useStockReceiptActions } from '../hooks/useStockReceipts'
import { useRawMaterialOptions, useSubmittedPurchaseOrders } from '../hooks/usePickerOptions'

export interface StockReceiptFormPageProps {
  onDone: () => void
  /** Pre-select this PO reference id (e.g. opened from a PO detail page). */
  initialPoRef?: string
}

export function StockReceiptFormPage({ onDone, initialPoRef }: StockReceiptFormPageProps) {
  const submittedPos = useSubmittedPurchaseOrders()
  const rawMaterials = useRawMaterialOptions()
  const actions = useStockReceiptActions()

  const poByRef = useMemo(
    () => new Map((submittedPos.data ?? []).map((po) => [po.reference_id, po])),
    [submittedPos.data],
  )
  const poOptions = (submittedPos.data ?? []).map((po) => ({
    value: po.reference_id,
    label: po.reference_id,
  }))

  const defaults: StockReceiptFormValues = {
    purchase_order_ref: initialPoRef ?? '',
    supplier_lot_number: '',
    lines: [{ ...EMPTY_RECEIPT_LINE }],
  }

  async function handleSubmit(values: StockReceiptFormValues): Promise<Result<unknown>> {
    const po = poByRef.get(values.purchase_order_ref)
    const poLines = po ? parsePoLines(po.lines) : []
    if (receivedVsOrdered(poLines, values.lines).overReceived) {
      return err(
        appError('validation', 'الكمية المستلمة تتجاوز المطلوب في أمر الشراء — صحّح البنود.'),
      )
    }
    try {
      await actions.createDraft({
        purchase_order_ref: values.purchase_order_ref,
        supplier_lot_number: values.supplier_lot_number,
        lines: serializeLines(values.lines),
      })
      onDone()
      return ok(undefined)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        return err(error as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ إذن الاستلام. حاول مرة أخرى.'))
    }
  }

  return (
    <Form
      schema={stockReceiptFormSchema}
      defaultValues={defaults as DefaultValues<StockReceiptFormValues>}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {({ formError, isSubmitting }) => (
        <>
          <SelectField
            name="purchase_order_ref"
            label={RECEIPT_FIELD_LABELS.purchase_order_ref!.ar}
            labelEn={RECEIPT_FIELD_LABELS.purchase_order_ref!.en}
            required
            options={poOptions}
            placeholder={
              submittedPos.isError
                ? 'تعذّر تحميل أوامر الشراء'
                : submittedPos.isLoading
                  ? 'جارٍ التحميل…'
                  : 'اختر أمر شراء معتمدًا…'
            }
          />

          <TextField
            name="supplier_lot_number"
            label={RECEIPT_FIELD_LABELS.supplier_lot_number!.ar}
            labelEn={RECEIPT_FIELD_LABELS.supplier_lot_number!.en}
            required
          />

          <PoLinesPrefill poByRef={poByRef} />
          <ReceiptLinesBridge poByRef={poByRef} rawMaterialOptions={rawMaterials.data ?? []} />

          <FormError message={formError} />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onDone} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting || actions.isPending}>
              {isSubmitting ? 'جارٍ الحفظ…' : 'إنشاء مسودة'}
            </Button>
          </div>
        </>
      )}
    </Form>
  )
}

/** Copies the chosen PO's lines into the receipt editor once per selection. */
function PoLinesPrefill({ poByRef }: { poByRef: Map<string, PurchaseOrder> }) {
  const { setValue } = useFormContext<StockReceiptFormValues>()
  const poRef = useWatch<StockReceiptFormValues>({ name: 'purchase_order_ref' }) as
    string | undefined
  const applied = useRef<string | null>(null)

  useEffect(() => {
    if (!poRef || poRef === applied.current) return
    const po = poByRef.get(poRef)
    if (!po) return
    const lines = parsePoLines(po.lines).map((line) => ({
      raw_material_id: line.raw_material_id,
      qty: line.qty,
      unit_price: line.unit_price,
    }))
    setValue('lines', lines.length > 0 ? lines : [{ ...EMPTY_RECEIPT_LINE }], {
      shouldValidate: false,
      shouldDirty: true,
    })
    applied.current = poRef
  }, [poRef, poByRef, setValue])

  return null
}

/** Renders the editor with the currently-selected PO's lines for guidance. */
function ReceiptLinesBridge({
  poByRef,
  rawMaterialOptions,
}: {
  poByRef: Map<string, PurchaseOrder>
  rawMaterialOptions: { value: string; label: string }[]
}) {
  const poRef = useWatch<StockReceiptFormValues>({ name: 'purchase_order_ref' }) as
    string | undefined
  const po = poRef ? poByRef.get(poRef) : undefined
  const poLines = po ? parsePoLines(po.lines) : []
  return <ReceiptLineEditor rawMaterialOptions={rawMaterialOptions} poLines={poLines} />
}
