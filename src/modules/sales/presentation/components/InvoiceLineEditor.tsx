/**
 * Customer-aware invoice line editor. One row per product: pick the product,
 * type the qty, see the admin `base_price` (read-only — price stability,
 * `IMPLEMENTATION_PLAN.md` §1 rule 4) and a `discount_pct` capped at the
 * product's ceiling. `net_price` and the running totals are derived live via the
 * pure `domain/pricing` helpers.
 *
 * Presentation only — all money maths comes from `domain/pricing`.
 */
import { useCallback, useMemo } from 'react'

import { formatCurrency } from '@/shared/formatters'
import { Button } from '@/shared/ui'

import { invoiceTotals, priceInvoiceLine } from '../../domain/pricing'
import type { InvoiceLine } from '../../domain/schemas'
import type { ProductOption } from '../hooks'

const CONTROL =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-white/15'

const EMPTY_LINE: InvoiceLine = {
  product_id: '',
  qty: 1,
  base_price: 0,
  discount_pct: 0,
  net_price: 0,
}

export interface InvoiceLineEditorProps {
  value: InvoiceLine[]
  onChange: (next: InvoiceLine[]) => void
  productOptions: readonly ProductOption[]
  /** The picked customer's discount — the starting discount for a new line. */
  customerDiscountPct: number
  disabled?: boolean
}

export function InvoiceLineEditor({
  value,
  onChange,
  productOptions,
  customerDiscountPct,
  disabled = false,
}: InvoiceLineEditorProps) {
  const productById = useMemo(
    () => new Map(productOptions.map((o) => [o.value, o])),
    [productOptions],
  )

  const reprice = useCallback(
    (line: InvoiceLine, patch: Partial<InvoiceLine>): InvoiceLine => {
      const merged = { ...line, ...patch }
      const product = productById.get(merged.product_id)
      if (!product) return { ...merged, base_price: 0, net_price: 0 }
      const priced = priceInvoiceLine(
        {
          $id: product.value,
          base_price: product.basePrice,
          default_discount_pct: product.defaultDiscountPct,
        },
        Number.isFinite(merged.qty) ? merged.qty : 0,
        merged.discount_pct,
      )
      return priced
    },
    [productById],
  )

  const update = useCallback(
    (index: number, patch: Partial<InvoiceLine>) => {
      onChange(value.map((line, i) => (i === index ? reprice(line, patch) : line)))
    },
    [value, onChange, reprice],
  )

  const pickProduct = useCallback(
    (index: number, productId: string) => {
      const product = productById.get(productId)
      const startingDiscount = product
        ? Math.min(
            customerDiscountPct,
            product.defaultDiscountPct > 0 ? product.defaultDiscountPct : customerDiscountPct,
          )
        : 0
      update(index, { product_id: productId, discount_pct: startingDiscount })
    },
    [productById, customerDiscountPct, update],
  )

  const remove = useCallback(
    (index: number) => onChange(value.filter((_, i) => i !== index)),
    [value, onChange],
  )

  const add = useCallback(
    () => onChange([...value, { ...EMPTY_LINE, discount_pct: customerDiscountPct }]),
    [value, onChange, customerDiscountPct],
  )

  const totals = useMemo(() => invoiceTotals(value), [value])

  return (
    <div className="space-y-2">
      <div
        className="grid gap-2 px-2 text-xs font-semibold text-zinc-500"
        style={{ gridTemplateColumns: '2fr 0.8fr 1fr 0.8fr 1fr auto' }}
      >
        <span>الصنف / Product</span>
        <span className="text-start">الكمية / Qty</span>
        <span className="text-start">السعر / Base</span>
        <span className="text-start">خصم٪ / Disc</span>
        <span className="text-start">الصافي / Net</span>
        <span />
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 px-3 py-4 text-center text-sm text-zinc-500 dark:border-white/15">
          أضف صنفًا لبدء الفاتورة.
        </p>
      ) : null}

      {value.map((line, index) => {
        const product = productById.get(line.product_id)
        const ceiling = product && product.defaultDiscountPct > 0 ? product.defaultDiscountPct : 100
        return (
          <div
            key={index}
            className="grid items-center gap-2 rounded-lg border border-black/10 p-2 dark:border-white/10"
            style={{ gridTemplateColumns: '2fr 0.8fr 1fr 0.8fr 1fr auto' }}
          >
            <select
              className={CONTROL}
              disabled={disabled}
              value={line.product_id}
              onChange={(e) => pickProduct(index, e.target.value)}
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

            <span dir="ltr" className="text-start text-sm tabular-nums text-zinc-500">
              {formatCurrency(line.base_price)}
            </span>

            <input
              type="number"
              dir="ltr"
              inputMode="decimal"
              min={0}
              max={ceiling}
              step="any"
              className={`${CONTROL} text-start`}
              disabled={disabled || !product}
              value={Number.isFinite(line.discount_pct) ? line.discount_pct : ''}
              onChange={(e) => update(index, { discount_pct: e.target.valueAsNumber })}
            />

            <span dir="ltr" className="text-start text-sm font-medium tabular-nums">
              {formatCurrency(line.net_price)}
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

      <div className="flex items-center justify-between pt-1">
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={add}>
          + إضافة صنف
        </Button>
        <dl className="flex gap-4 text-sm">
          <div className="flex gap-1">
            <dt className="text-zinc-500">الإجمالي / Gross</dt>
            <dd dir="ltr" className="tabular-nums">
              {formatCurrency(totals.gross_total)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-zinc-500">الخصم / Disc</dt>
            <dd dir="ltr" className="tabular-nums">
              {formatCurrency(totals.discount_total)}
            </dd>
          </div>
          <div className="flex gap-1 font-semibold">
            <dt className="text-zinc-500">الصافي / Net</dt>
            <dd dir="ltr" className="tabular-nums">
              {formatCurrency(totals.net_total)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
