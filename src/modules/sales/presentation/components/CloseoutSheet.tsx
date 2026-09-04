/**
 * The rep daily close-out worksheet (`IMPLEMENTATION_PLAN.md` Phase 2 Story
 * 2.4). Per product: issued / sold / returned / remaining (the expected bag)
 * against the rep's physical count. Per cash method: expected vs. counted. The
 * live reconciliation (variance + flags) comes from the pure
 * `domain/closeout.reconcileCloseout`.
 *
 * `expected` is normally built by the `rep-closeout` Function from the day's
 * issues / sales / returns. Until that lands, when `onExpectedChange` is passed
 * the account manager can enter the figures by hand.
 *
 * Presentation only — reconciliation maths comes from `domain/closeout`.
 */
import { useMemo } from 'react'

import { formatCurrency, formatNumber } from '@/shared/formatters'

import { reconcileCloseout } from '../../domain/closeout'
import {
  CLOSEOUT_CASH_METHODS,
  type CloseoutActual,
  type CloseoutCashMethod,
  type CloseoutExpected,
} from '../../domain/schemas'
import { PAYMENT_METHOD_LABEL } from '../labels'

const CONTROL =
  'w-full rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-white/15'

export interface CloseoutSheetProps {
  expected: CloseoutExpected
  actual: CloseoutActual
  onActualChange: (next: CloseoutActual) => void
  onExpectedChange?: (next: CloseoutExpected) => void
  /** `Map<product_id, label>` for display. */
  productLabelById: ReadonlyMap<string, string>
  productOptions?: readonly { value: string; label: string }[]
  disabled?: boolean
}

function num(raw: number): number {
  return Number.isFinite(raw) ? raw : 0
}

export function CloseoutSheet({
  expected,
  actual,
  onActualChange,
  onExpectedChange,
  productLabelById,
  productOptions = [],
  disabled = false,
}: CloseoutSheetProps) {
  const reconciliation = useMemo(() => reconcileCloseout(expected, actual), [expected, actual])

  const countedByProduct = new Map(actual.products.map((p) => [p.product_id, p.counted]))
  const countedByMethod = new Map(actual.cash.map((c) => [c.method, c.amount]))
  const expectedByMethod = new Map(expected.cash.map((c) => [c.method, c.amount]))

  const setCounted = (productId: string, counted: number) => {
    const others = actual.products.filter((p) => p.product_id !== productId)
    onActualChange({
      ...actual,
      products: [...others, { product_id: productId, counted: num(counted) }],
    })
  }

  const setCountedCash = (method: CloseoutCashMethod, amount: number) => {
    const others = actual.cash.filter((c) => c.method !== method)
    onActualChange({ ...actual, cash: [...others, { method, amount: num(amount) }] })
  }

  const patchExpectedProduct = (
    productId: string,
    patch: Partial<CloseoutExpected['products'][number]>,
  ) => {
    if (!onExpectedChange) return
    onExpectedChange({
      ...expected,
      products: expected.products.map((p) => (p.product_id === productId ? { ...p, ...patch } : p)),
    })
  }

  const addExpectedProduct = (productId: string) => {
    if (!onExpectedChange || !productId) return
    if (expected.products.some((p) => p.product_id === productId)) return
    onExpectedChange({
      ...expected,
      products: [
        ...expected.products,
        { product_id: productId, issued: 0, sold: 0, returned: 0, remaining: 0 },
      ],
    })
  }

  const setExpectedCash = (method: CloseoutCashMethod, amount: number) => {
    if (!onExpectedChange) return
    const others = expected.cash.filter((c) => c.method !== method)
    onExpectedChange({ ...expected, cash: [...others, { method, amount: num(amount) }] })
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">جرد العهدة / Stock custody</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="p-2 text-start">الصنف / Product</th>
                <th className="p-2 text-end">صُرف / Issued</th>
                <th className="p-2 text-end">بيع / Sold</th>
                <th className="p-2 text-end">مرتجع / Returned</th>
                <th className="p-2 text-end">متبقٍ / Remaining</th>
                <th className="p-2 text-end">معدود / Counted</th>
                <th className="p-2 text-end">الفرق / Δ</th>
              </tr>
            </thead>
            <tbody>
              {expected.products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-3 text-center text-zinc-500">
                    لا توجد أصناف في العهدة المتوقعة.
                  </td>
                </tr>
              ) : null}
              {expected.products.map((p) => {
                const counted = countedByProduct.get(p.product_id) ?? 0
                const delta = counted - p.remaining
                return (
                  <tr key={p.product_id} className="border-t border-black/5 dark:border-white/5">
                    <td className="p-2">{productLabelById.get(p.product_id) ?? p.product_id}</td>
                    {(['issued', 'sold', 'returned', 'remaining'] as const).map((field) => (
                      <td key={field} className="p-2 text-end">
                        {onExpectedChange ? (
                          <input
                            type="number"
                            dir="ltr"
                            step="any"
                            className={`${CONTROL} text-end`}
                            disabled={disabled}
                            value={Number.isFinite(p[field]) ? p[field] : ''}
                            onChange={(e) =>
                              patchExpectedProduct(p.product_id, {
                                [field]: e.target.valueAsNumber,
                              })
                            }
                          />
                        ) : (
                          <span dir="ltr">{formatNumber(p[field])}</span>
                        )}
                      </td>
                    ))}
                    <td className="p-2 text-end">
                      <input
                        type="number"
                        dir="ltr"
                        step="any"
                        className={`${CONTROL} text-end`}
                        disabled={disabled}
                        value={Number.isFinite(counted) ? counted : ''}
                        onChange={(e) => setCounted(p.product_id, e.target.valueAsNumber)}
                      />
                    </td>
                    <td
                      dir="ltr"
                      className={`p-2 text-end font-medium tabular-nums ${
                        delta === 0 ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {delta > 0 ? '+' : ''}
                      {formatNumber(delta)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {onExpectedChange && productOptions.length > 0 ? (
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <span>إضافة صنف للعهدة المتوقعة:</span>
            <select
              className={`${CONTROL} max-w-xs`}
              disabled={disabled}
              value=""
              onChange={(e) => addExpectedProduct(e.target.value)}
            >
              <option value="" disabled>
                اختر صنفًا…
              </option>
              {productOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">مطابقة النقدية / Cash reconciliation</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="p-2 text-start">الطريقة / Method</th>
                <th className="p-2 text-end">المتوقع / Expected</th>
                <th className="p-2 text-end">المعدود / Counted</th>
                <th className="p-2 text-end">الفرق / Δ</th>
              </tr>
            </thead>
            <tbody>
              {CLOSEOUT_CASH_METHODS.map((method) => {
                const exp = expectedByMethod.get(method) ?? 0
                const got = countedByMethod.get(method) ?? 0
                const delta = got - exp
                return (
                  <tr key={method} className="border-t border-black/5 dark:border-white/5">
                    <td className="p-2">{PAYMENT_METHOD_LABEL[method]}</td>
                    <td className="p-2 text-end">
                      {onExpectedChange ? (
                        <input
                          type="number"
                          dir="ltr"
                          step="any"
                          className={`${CONTROL} text-end`}
                          disabled={disabled}
                          value={Number.isFinite(exp) ? exp : ''}
                          onChange={(e) => setExpectedCash(method, e.target.valueAsNumber)}
                        />
                      ) : (
                        <span dir="ltr">{formatCurrency(exp)}</span>
                      )}
                    </td>
                    <td className="p-2 text-end">
                      <input
                        type="number"
                        dir="ltr"
                        step="any"
                        className={`${CONTROL} text-end`}
                        disabled={disabled}
                        value={Number.isFinite(got) ? got : ''}
                        onChange={(e) => setCountedCash(method, e.target.valueAsNumber)}
                      />
                    </td>
                    <td
                      dir="ltr"
                      className={`p-2 text-end font-medium tabular-nums ${
                        delta === 0 ? 'text-zinc-500' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {delta > 0 ? '+' : ''}
                      {formatCurrency(delta)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
        <div className="flex flex-wrap gap-4">
          <span>
            فرق المخزون / Stock variance:{' '}
            <strong dir="ltr" className="tabular-nums">
              {formatNumber(reconciliation.stock_variance)}
            </strong>
          </span>
          <span>
            فرق النقدية / Cash variance:{' '}
            <strong dir="ltr" className="tabular-nums">
              {formatCurrency(reconciliation.cash_variance)}
            </strong>
          </span>
        </div>
        {reconciliation.flags.length > 0 ? (
          <ul className="mt-2 list-inside list-disc text-xs text-red-600 dark:text-red-400">
            {reconciliation.flags.map((flag) => (
              <li key={flag} dir="ltr">
                {flag}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            لا توجد فروقات — جاهز للتأكيد.
          </p>
        )}
      </section>
    </div>
  )
}
