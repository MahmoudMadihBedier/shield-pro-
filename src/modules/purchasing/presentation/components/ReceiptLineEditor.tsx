import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'

import { formatNumber } from '@/shared/formatters'
import { NumberField, SelectField, type SelectOption } from '@/shared/forms'
import { Button } from '@/shared/ui'

import { receivedVsOrdered } from '../../domain/lines'
import { RECEIPT_FIELD_LABELS } from '../../domain/labels'
import type { PoLine } from '../../domain/schemas'
import { EMPTY_RECEIPT_LINE } from './line-defaults'

interface WatchedLine {
  raw_material_id?: string
  qty?: number
}

export interface ReceiptLineEditorProps {
  rawMaterialOptions: SelectOption[]
  /** Lines of the referenced purchase order — drives the ordered/remaining guidance. */
  poLines: PoLine[]
  disabled?: boolean
  name?: string
}

/**
 * Receipt line editor, pre-filled from the referenced PO. Shows an
 * ordered / received / remaining reconciliation per raw material and blocks
 * nothing itself — the form page checks `overReceived` before it saves.
 */
export function ReceiptLineEditor({
  rawMaterialOptions,
  poLines,
  disabled = false,
  name = 'lines',
}: ReceiptLineEditorProps) {
  const { control } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name })
  const watched = (useWatch({ control, name }) as WatchedLine[] | undefined) ?? []

  const reconciliation = receivedVsOrdered(
    poLines,
    watched.map((line) => ({
      raw_material_id: String(line?.raw_material_id ?? ''),
      qty: Number(line?.qty) || 0,
    })),
  )
  const progressByMaterial = new Map(reconciliation.byMaterial.map((m) => [m.raw_material_id, m]))

  return (
    <div className="space-y-3">
      {reconciliation.overReceived ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          الكمية المستلمة تتجاوز الكمية المطلوبة في أمر الشراء — لا يمكن الحفظ قبل تصحيح البنود.
        </p>
      ) : null}

      <div className="space-y-3">
        {fields.map((field, index) => {
          const materialId = String(watched[index]?.raw_material_id ?? '')
          const progress = progressByMaterial.get(materialId)
          return (
            <div
              key={field.id}
              className="grid gap-2 rounded-lg border border-black/10 p-3 sm:grid-cols-[1fr_7rem_9rem_auto] sm:items-end dark:border-white/10"
            >
              <SelectField
                name={`${name}.${index}.raw_material_id`}
                label={RECEIPT_FIELD_LABELS.raw_material_id!.ar}
                labelEn={RECEIPT_FIELD_LABELS.raw_material_id!.en}
                options={rawMaterialOptions}
                placeholder="اختر الخامة…"
                disabled={disabled}
                required
              />
              <NumberField
                name={`${name}.${index}.qty`}
                label={RECEIPT_FIELD_LABELS.qty!.ar}
                labelEn={RECEIPT_FIELD_LABELS.qty!.en}
                min={0}
                disabled={disabled}
                required
              />
              <NumberField
                name={`${name}.${index}.unit_price`}
                label={RECEIPT_FIELD_LABELS.unit_price!.ar}
                labelEn={RECEIPT_FIELD_LABELS.unit_price!.en}
                min={0}
                disabled={disabled}
                required
              />
              <div className="flex items-center justify-end pb-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(index)}
                  disabled={disabled || fields.length <= 1}
                  aria-label="حذف البند"
                >
                  ×
                </Button>
              </div>
              {progress ? (
                <p
                  className={`text-xs sm:col-span-4 ${
                    progress.overReceived ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'
                  }`}
                  dir="ltr"
                >
                  {RECEIPT_FIELD_LABELS.ordered!.ar} {formatNumber(progress.ordered)} ·{' '}
                  {RECEIPT_FIELD_LABELS.received!.ar} {formatNumber(progress.received)} ·{' '}
                  {RECEIPT_FIELD_LABELS.remaining!.ar} {formatNumber(progress.remaining)}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => append({ ...EMPTY_RECEIPT_LINE })}
        disabled={disabled}
      >
        + إضافة بند
      </Button>
    </div>
  )
}
