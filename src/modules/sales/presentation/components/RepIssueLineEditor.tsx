/**
 * Rep stock-issue line editor. One row per product: product, qty and an
 * optional lot number. Controlled `value` / `onChange` (`RepIssueLine[]`).
 */
import { useCallback } from 'react'

import { Button } from '@/shared/ui'
import type { SelectOption } from '@/shared/forms'

import type { RepIssueLine } from '../../domain/schemas'

const CONTROL =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-white/15'

export interface RepIssueLineEditorProps {
  value: RepIssueLine[]
  onChange: (next: RepIssueLine[]) => void
  productOptions: readonly SelectOption[]
  disabled?: boolean
}

export function RepIssueLineEditor({
  value,
  onChange,
  productOptions,
  disabled = false,
}: RepIssueLineEditorProps) {
  const update = useCallback(
    (index: number, patch: Partial<RepIssueLine>) => {
      onChange(value.map((line, i) => (i === index ? { ...line, ...patch } : line)))
    },
    [value, onChange],
  )

  const remove = useCallback(
    (index: number) => onChange(value.filter((_, i) => i !== index)),
    [value, onChange],
  )

  const add = useCallback(
    () => onChange([...value, { product_id: '', qty: 1, lot_number: null }]),
    [value, onChange],
  )

  return (
    <div className="space-y-2">
      <div
        className="grid gap-2 px-2 text-xs font-semibold text-zinc-500"
        style={{ gridTemplateColumns: '2fr 1fr 1.4fr auto' }}
      >
        <span>الصنف / Product</span>
        <span className="text-start">الكمية / Qty</span>
        <span className="text-start">رقم التشغيلة / Lot</span>
        <span />
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 px-3 py-4 text-center text-sm text-zinc-500 dark:border-white/15">
          أضف صنفًا لصرف العهدة.
        </p>
      ) : null}

      {value.map((line, index) => (
        <div
          key={index}
          className="grid items-center gap-2 rounded-lg border border-black/10 p-2 dark:border-white/10"
          style={{ gridTemplateColumns: '2fr 1fr 1.4fr auto' }}
        >
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

          <input
            type="text"
            dir="ltr"
            className={`${CONTROL} text-start`}
            disabled={disabled}
            value={line.lot_number ?? ''}
            onChange={(e) => update(index, { lot_number: e.target.value || null })}
          />

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
