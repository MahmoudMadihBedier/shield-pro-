/**
 * Customer-aware invoice line editor. One row per product: pick the product,
 * choose the SALE unit (the product's stock unit or a configured alternate like
 * a carton) and type the qty in that unit. The stored `qty` is always in the
 * product's stock unit (`sale_qty × factor`) — the pricing + stock-deduction
 * key. `base_price` stays the admin price per stock unit (price stability,
 * `IMPLEMENTATION_PLAN.md` §1 rule 4); the per-row "Base" / "Net" columns show
 * it scaled to the chosen sale unit for the seller.
 *
 * Presentation only — all money maths comes from `domain/pricing`.
 */
import { useCallback, useMemo } from 'react'

import { formatCurrency, formatNumber } from '@/shared/formatters'
import { Button } from '@/shared/ui'

import { invoiceTotals, priceInvoiceLine } from '../../domain/pricing'
import { toBaseQty, unitShort, type InvoiceLine } from '../../domain/schemas'
import type { ProductOption } from '../hooks'

const CONTROL =
  'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 py-2 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 disabled:opacity-50'

const GRID = { gridTemplateColumns: '2fr 0.8fr 0.9fr 1fr 0.7fr 1fr auto' } as const

const EMPTY_LINE: InvoiceLine = {
  product_id: '',
  qty: 1,
  sale_unit: '',
  sale_qty: 1,
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

  /** Factor of the sale unit chosen on `line` (1 when unknown / stock unit). */
  const factorOf = useCallback(
    (line: InvoiceLine): number => {
      const product = productById.get(line.product_id)
      if (!product) return 1
      const su = product.saleUnits.find((u) => u.unit === line.sale_unit)
      return su ? su.factor : 1
    },
    [productById],
  )

  const reprice = useCallback(
    (line: InvoiceLine, patch: Partial<InvoiceLine>): InvoiceLine => {
      const merged = { ...line, ...patch }
      const product = productById.get(merged.product_id)
      const saleQty = Number.isFinite(merged.sale_qty) ? (merged.sale_qty ?? 0) : 0
      const factor = product
        ? (product.saleUnits.find((u) => u.unit === merged.sale_unit)?.factor ?? 1)
        : 1
      const baseQty = toBaseQty(saleQty, factor)

      if (!product) {
        return { ...merged, qty: baseQty, base_price: 0, net_price: 0 }
      }
      const priced = priceInvoiceLine(
        {
          $id: product.value,
          base_price: product.basePrice,
          default_discount_pct: product.defaultDiscountPct,
        },
        baseQty,
        merged.discount_pct,
      )
      return { ...priced, sale_unit: merged.sale_unit, sale_qty: saleQty }
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
      update(index, {
        product_id: productId,
        discount_pct: startingDiscount,
        sale_unit: product?.saleUnits[0]?.unit ?? '',
      })
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
      <div className="grid gap-2 px-2 text-xs font-semibold text-[var(--text-muted)]" style={GRID}>
        <span>الصنف / Product</span>
        <span className="text-start">الكمية / Qty</span>
        <span className="text-start">الوحدة / Unit</span>
        <span className="text-start">السعر / Base</span>
        <span className="text-start">خصم٪</span>
        <span className="text-start">الصافي / Net</span>
        <span />
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-4 text-center text-sm text-[var(--text-muted)]">
          أضف صنفًا لبدء الفاتورة.
        </p>
      ) : null}

      {value.map((line, index) => {
        const product = productById.get(line.product_id)
        const ceiling = product && product.defaultDiscountPct > 0 ? product.defaultDiscountPct : 100
        const factor = factorOf(line)
        const saleUnits = product?.saleUnits ?? []
        return (
          <div
            key={index}
            className="grid items-center gap-2 rounded-lg border border-[var(--border)] p-2"
            style={GRID}
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

            <div>
              <input
                type="number"
                dir="ltr"
                inputMode="decimal"
                min={0}
                step="any"
                className={`${CONTROL} text-start`}
                disabled={disabled}
                value={Number.isFinite(line.sale_qty) ? line.sale_qty : ''}
                onChange={(e) => update(index, { sale_qty: e.target.valueAsNumber })}
              />
              {factor !== 1 ? (
                <span className="mt-0.5 block text-[10px] text-[var(--text-subtle)]" dir="ltr">
                  = {formatNumber(line.qty)} {unitShort(product?.unit)}
                </span>
              ) : null}
            </div>

            <select
              className={CONTROL}
              disabled={disabled || saleUnits.length <= 1}
              value={line.sale_unit ?? ''}
              onChange={(e) => update(index, { sale_unit: e.target.value })}
            >
              {saleUnits.length === 0 ? <option value="">—</option> : null}
              {saleUnits.map((su) => (
                <option key={su.unit} value={su.unit}>
                  {su.label}
                  {su.factor !== 1 ? ` (×${su.factor})` : ''}
                </option>
              ))}
            </select>

            <span dir="ltr" className="text-start text-sm tabular-nums text-[var(--text-muted)]">
              {formatCurrency(line.base_price * factor)}
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
              {formatCurrency(line.net_price * factor)}
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
            <dt className="text-[var(--text-muted)]">الإجمالي / Gross</dt>
            <dd dir="ltr" className="tabular-nums">
              {formatCurrency(totals.gross_total)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="text-[var(--text-muted)]">الخصم / Disc</dt>
            <dd dir="ltr" className="tabular-nums">
              {formatCurrency(totals.discount_total)}
            </dd>
          </div>
          <div className="flex gap-1 font-semibold">
            <dt className="text-[var(--text-muted)]">الصافي / Net</dt>
            <dd dir="ltr" className="tabular-nums">
              {formatCurrency(totals.net_total)}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
