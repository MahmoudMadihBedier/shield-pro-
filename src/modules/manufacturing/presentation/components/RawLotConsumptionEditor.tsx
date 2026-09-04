/**
 * Controlled add/remove editor for `production_batches.raw_material_lots` —
 * a list of `{ purchase_order_ref, qty_consumed }` rows. Holds no state of its
 * own; the parent owns the array (see `../raw-lot-rows.ts`) and re-validates it
 * through `rawMaterialLotSchema` on submit.
 */
import { Button } from '@/shared/ui'

import type { RawLotDraftRow } from '../raw-lot-rows'
import { emptyRawLotRow } from '../raw-lot-rows'

export interface RawLotConsumptionEditorProps {
  rows: RawLotDraftRow[]
  onChange: (next: RawLotDraftRow[]) => void
  disabled?: boolean
}

const INPUT_CLASS =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15'

export function RawLotConsumptionEditor({
  rows,
  onChange,
  disabled = false,
}: RawLotConsumptionEditorProps) {
  const update = (index: number, patch: Partial<RawLotDraftRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index))
  const add = () => onChange([...rows, emptyRawLotRow()])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
          الخامات المستهلكة / Consumed raw lots
        </span>
        <Button type="button" size="sm" variant="secondary" onClick={add} disabled={disabled}>
          + سطر
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">لم تُضف أي خامات بعد.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={index} className="flex items-end gap-2">
              <label className="flex-1 text-xs text-zinc-500">
                مرجع أمر الشراء / PO ref
                <input
                  className={INPUT_CLASS}
                  dir="ltr"
                  value={row.purchase_order_ref}
                  disabled={disabled}
                  onChange={(e) => update(index, { purchase_order_ref: e.target.value })}
                />
              </label>
              <label className="w-32 text-xs text-zinc-500">
                الكمية / Qty
                <input
                  className={`${INPUT_CLASS} text-start`}
                  type="number"
                  dir="ltr"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={row.qty_consumed}
                  disabled={disabled}
                  onChange={(e) => update(index, { qty_consumed: e.target.value })}
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => remove(index)}
                disabled={disabled}
              >
                حذف
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
