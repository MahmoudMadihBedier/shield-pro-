import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'

import { formatCurrency } from '@/shared/formatters'
import { NumberField, SelectField, type SelectOption } from '@/shared/forms'
import { Button } from '@/shared/ui'

import { poTotal } from '../../domain/lines'
import { PO_FIELD_LABELS } from '../../domain/labels'
import { EMPTY_PO_LINE } from './line-defaults'

interface WatchedLine {
  qty?: number
  unit_price?: number
}

export interface PoLineEditorProps {
  /** Options for the raw-material picker on each row. */
  rawMaterialOptions: SelectOption[]
  disabled?: boolean
  /** RHF field-array name — defaults to `lines`. */
  name?: string
}

/**
 * Add / remove raw-material rows (raw material + qty + unit price) with a live
 * running total via `poTotal`. Must render inside a shared `<Form>` — it binds
 * through `useFieldArray` / the shared form fields.
 */
export function PoLineEditor({
  rawMaterialOptions,
  disabled = false,
  name = 'lines',
}: PoLineEditorProps) {
  const { control } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name })
  const watched = (useWatch({ control, name }) as WatchedLine[] | undefined) ?? []

  const total = poTotal(
    watched.map((line) => ({
      qty: Number(line?.qty) || 0,
      unit_price: Number(line?.unit_price) || 0,
    })),
  )

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {fields.map((field, index) => {
          const line = watched[index]
          const lineTotal = (Number(line?.qty) || 0) * (Number(line?.unit_price) || 0)
          return (
            <div
              key={field.id}
              className="grid gap-2 rounded-lg border border-black/10 p-3 sm:grid-cols-[1fr_7rem_9rem_auto] sm:items-end dark:border-white/10"
            >
              <SelectField
                name={`${name}.${index}.raw_material_id`}
                label={PO_FIELD_LABELS.raw_material_id!.ar}
                labelEn={PO_FIELD_LABELS.raw_material_id!.en}
                options={rawMaterialOptions}
                placeholder="اختر الخامة…"
                disabled={disabled}
                required
              />
              <NumberField
                name={`${name}.${index}.qty`}
                label={PO_FIELD_LABELS.qty!.ar}
                labelEn={PO_FIELD_LABELS.qty!.en}
                min={0}
                disabled={disabled}
                required
              />
              <NumberField
                name={`${name}.${index}.unit_price`}
                label={PO_FIELD_LABELS.unit_price!.ar}
                labelEn={PO_FIELD_LABELS.unit_price!.en}
                min={0}
                disabled={disabled}
                required
              />
              <div className="flex items-center justify-between gap-2 pb-1">
                <span className="text-xs text-zinc-500" dir="ltr">
                  {formatCurrency(lineTotal)}
                </span>
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
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => append({ ...EMPTY_PO_LINE })}
          disabled={disabled}
        >
          + إضافة بند
        </Button>
        <span className="text-sm font-semibold" dir="ltr">
          {PO_FIELD_LABELS.total_value!.ar}: {formatCurrency(total)}
        </span>
      </div>
    </div>
  )
}
