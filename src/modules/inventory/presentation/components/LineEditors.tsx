/**
 * Controlled line-item editors for transfers and write-offs. Both edit the same
 * `{ product_id, qty, lot_number? }` shape, so one internal `LineListEditor`
 * backs the two named exports (`claude.md` — no duplication).
 *
 * Presentation only: local `value` / `onChange`, zero business logic. The
 * parent form owns the array (via React Hook Form) and Zod validates on submit.
 */
import { useCallback } from 'react'

import { Button } from '@/shared/ui'

import type { Option } from '../hooks'

export interface QtyLotLine {
  product_id: string
  qty: number
  lot_number?: string | null
}

const CONTROL =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-white/15'

interface LineListEditorProps {
  value: QtyLotLine[]
  onChange: (next: QtyLotLine[]) => void
  productOptions: readonly Option[]
  disabled?: boolean
  /** Show the lot-number column (transfers care about lots; write-offs may not). */
  withLot?: boolean
}

function LineListEditor({
  value,
  onChange,
  productOptions,
  disabled = false,
  withLot = true,
}: LineListEditorProps) {
  const update = useCallback(
    (index: number, patch: Partial<QtyLotLine>) => {
      onChange(value.map((line, i) => (i === index ? { ...line, ...patch } : line)))
    },
    [value, onChange],
  )

  const remove = useCallback(
    (index: number) => onChange(value.filter((_, i) => i !== index)),
    [value, onChange],
  )

  const add = useCallback(
    () => onChange([...value, { product_id: '', qty: 1, lot_number: '' }]),
    [value, onChange],
  )

  return (
    <div className="space-y-2">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 px-3 py-4 text-center text-sm text-zinc-500 dark:border-white/15">
          لا توجد أصناف بعد — أضف صنفًا للبدء.
        </p>
      ) : null}

      {value.map((line, index) => (
        <div
          key={index}
          className="grid items-end gap-2 rounded-lg border border-black/10 p-2 dark:border-white/10"
          style={{ gridTemplateColumns: withLot ? '2fr 1fr 1fr auto' : '2fr 1fr auto' }}
        >
          <label className="block text-xs text-zinc-500">
            الصنف / Product
            <select
              className={CONTROL}
              disabled={disabled}
              value={line.product_id}
              onChange={(e) => update(index, { product_id: e.target.value })}
            >
              <option value="" disabled>
                اختر صنفًا…
              </option>
              {productOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-zinc-500">
            الكمية / Qty
            <input
              type="number"
              dir="ltr"
              inputMode="decimal"
              min={0}
              step="any"
              className={`${CONTROL} text-start`}
              disabled={disabled}
              value={Number.isFinite(line.qty) ? line.qty : ''}
              onChange={(e) => update(index, { qty: e.target.valueAsNumber })}
            />
          </label>

          {withLot ? (
            <label className="block text-xs text-zinc-500">
              التشغيلة / Lot
              <input
                type="text"
                dir="ltr"
                className={`${CONTROL} text-start`}
                disabled={disabled}
                value={line.lot_number ?? ''}
                onChange={(e) => update(index, { lot_number: e.target.value || null })}
              />
            </label>
          ) : null}

          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={disabled}
            onClick={() => remove(index)}
          >
            حذف
          </Button>
        </div>
      ))}

      <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={add}>
        + إضافة صنف
      </Button>
    </div>
  )
}

export type LineEditorProps = Omit<LineListEditorProps, 'withLot'>

export function TransferLineEditor(props: LineEditorProps) {
  return <LineListEditor {...props} withLot />
}

export function WriteOffLineEditor(props: LineEditorProps) {
  return <LineListEditor {...props} withLot />
}
