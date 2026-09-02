/**
 * The physical-count worksheet. One row per product: pick the product, type the
 * counted qty, and see the recorded qty and the live variance
 * (`counted − recorded`) computed via the domain helper.
 *
 * Presentation only — variance maths comes from `domain/variance`.
 */
import { useCallback, useMemo } from 'react'

import { formatNumber } from '@/shared/formatters'
import { Button } from '@/shared/ui'

import { computeVariances } from '../../domain/variance'
import type { CountLine } from '../../domain/schemas'
import type { Option } from '../hooks'

const CONTROL =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-white/15'

export interface CountSheetProps {
  value: CountLine[]
  onChange: (next: CountLine[]) => void
  /** `bin_balances` qty keyed by `product_id` — the recorded side of the variance. */
  recordedByProduct: ReadonlyMap<string, number>
  productOptions: readonly Option[]
  disabled?: boolean
}

export function CountSheet({
  value,
  onChange,
  recordedByProduct,
  productOptions,
  disabled = false,
}: CountSheetProps) {
  const variances = useMemo(
    () => computeVariances(value, recordedByProduct),
    [value, recordedByProduct],
  )

  const update = useCallback(
    (index: number, patch: Partial<CountLine>) => {
      onChange(value.map((line, i) => (i === index ? { ...line, ...patch } : line)))
    },
    [value, onChange],
  )

  const remove = useCallback(
    (index: number) => onChange(value.filter((_, i) => i !== index)),
    [value, onChange],
  )

  const add = useCallback(
    () => onChange([...value, { product_id: '', counted_qty: 0 }]),
    [value, onChange],
  )

  return (
    <div className="space-y-2">
      <div
        className="grid gap-2 px-2 text-xs font-semibold text-zinc-500"
        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto' }}
      >
        <span>الصنف / Product</span>
        <span className="text-start">المسجّل / Recorded</span>
        <span className="text-start">المعدود / Counted</span>
        <span className="text-start">الفرق / Variance</span>
        <span />
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 px-3 py-4 text-center text-sm text-zinc-500 dark:border-white/15">
          أضف صنفًا لبدء الجرد.
        </p>
      ) : null}

      {value.map((line, index) => {
        const recorded = recordedByProduct.get(line.product_id) ?? 0
        const variance = variances[index]?.variance ?? line.counted_qty - recorded
        const varianceTone =
          variance === 0
            ? 'text-zinc-500'
            : variance > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
        return (
          <div
            key={index}
            className="grid items-center gap-2 rounded-lg border border-black/10 p-2 dark:border-white/10"
            style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto' }}
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

            <span dir="ltr" className="text-start text-sm tabular-nums text-zinc-500">
              {formatNumber(recorded)}
            </span>

            <input
              type="number"
              dir="ltr"
              inputMode="decimal"
              min={0}
              step="any"
              className={`${CONTROL} text-start`}
              disabled={disabled}
              value={Number.isFinite(line.counted_qty) ? line.counted_qty : ''}
              onChange={(e) => update(index, { counted_qty: e.target.valueAsNumber })}
            />

            <span dir="ltr" className={`text-start text-sm font-medium tabular-nums ${varianceTone}`}>
              {variance > 0 ? '+' : ''}
              {formatNumber(variance)}
            </span>

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
        )
      })}

      <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={add}>
        + إضافة صنف
      </Button>
    </div>
  )
}
