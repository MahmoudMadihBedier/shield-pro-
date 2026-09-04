/**
 * One sales invoice: envelope + priced lines + payment split, the
 * Draft→Submit / Submitted→Cancel bar, and — once Submitted — a panel that
 * posts the invoice into the stock + GL ledgers (`postInvoiceToLedger`, the
 * idempotent two-step) against the rep's custody warehouse.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { DocStatus } from '@/core/doc-status'
import type { AppError } from '@/core/errors'
import { formatCurrency, formatDateTime, formatNumber } from '@/shared/formatters'
import { Button, Card, PageHeader } from '@/shared/ui'

import { postInvoiceToLedger, type InvoiceLedgerPosting } from '../../data/post-sales'
import { canActOnSales } from '../../domain/permissions'
import { parseInvoiceLines, type InvoiceLine, type SalesInvoiceRow } from '../../domain/schemas'
import { DocStatusPill, SubmitCancelBar } from '../components'
import {
  optionLabelMap,
  useCustomerOptions,
  useProductOptions,
  useRepCustodyWarehouseOptions,
  useRepOptions,
  useSalesInvoice,
  useSalesInvoiceActions,
} from '../hooks'
import { PAYMENT_METHOD_LABEL } from '../labels'

export function SalesInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { principal } = useAuth()
  const canAct = canActOnSales(principal)

  const query = useSalesInvoice(id)
  const actions = useSalesInvoiceActions()

  const products = useProductOptions()
  const customers = useCustomerOptions()
  const reps = useRepOptions()
  const productLabel = useMemo(() => optionLabelMap(products.data), [products.data])
  const customerLabel = useMemo(() => optionLabelMap(customers.data), [customers.data])
  const repLabel = useMemo(() => optionLabelMap(reps.data), [reps.data])

  const isPending =
    actions.submit.isPending || actions.cancel.isPending || actions.createDraft.isPending

  if (query.isLoading) return <p className="text-sm text-zinc-500">جارٍ تحميل الفاتورة…</p>
  if (query.isError) {
    return (
      <Card className="text-sm text-red-600 dark:text-red-400">
        {query.error.message}{' '}
        <button type="button" className="underline" onClick={() => void query.refetch()}>
          إعادة المحاولة
        </button>
      </Card>
    )
  }
  const invoice = query.data
  if (!invoice) return <Card className="text-sm text-zinc-500">لا توجد فاتورة بهذا المعرّف.</Card>

  let lines: InvoiceLine[] = []
  try {
    lines = parseInvoiceLines(invoice.lines)
  } catch {
    lines = []
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`فاتورة ${invoice.reference_id}`}
        titleEn="Sales invoice"
        actions={
          <Button variant="ghost" onClick={() => navigate('/sales/invoices')}>
            رجوع
          </Button>
        }
      />

      <Card className="space-y-2 text-sm">
        <Row label="الحالة">
          <DocStatusPill status={invoice.doc_status} />
        </Row>
        <Row label="العميل">{customerLabel.get(invoice.customer_id) ?? invoice.customer_id}</Row>
        <Row label="المندوب">{repLabel.get(invoice.rep_user_id) ?? invoice.rep_user_id}</Row>
        <Row label="طريقة الدفع">{PAYMENT_METHOD_LABEL[invoice.payment_method]}</Row>
        <Row label="نقدًا / آجل">
          <span dir="ltr">
            {formatCurrency(invoice.cash_amount)} / {formatCurrency(invoice.credit_amount)}
          </span>
        </Row>
        {invoice.bank_reference ? (
          <Row label="مرجع الحوالة">
            <span dir="ltr">{invoice.bank_reference}</span>
          </Row>
        ) : null}
        <Row label="الموقع">
          <span dir="ltr">{invoice.geo}</span>
        </Row>
        <Row label="التاريخ">{formatDateTime(invoice.posting_datetime)}</Row>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">بنود الفاتورة / Lines</h3>
        {lines.length === 0 ? (
          <p className="text-sm text-zinc-500">لا توجد بنود.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="p-2 text-start">الصنف</th>
                  <th className="p-2 text-end">الكمية</th>
                  <th className="p-2 text-end">السعر</th>
                  <th className="p-2 text-end">خصم٪</th>
                  <th className="p-2 text-end">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr
                    key={`${line.product_id}-${index}`}
                    className="border-t border-black/5 dark:border-white/5"
                  >
                    <td className="p-2">{productLabel.get(line.product_id) ?? line.product_id}</td>
                    <td className="p-2 text-end" dir="ltr">
                      {formatNumber(line.qty)}
                    </td>
                    <td className="p-2 text-end" dir="ltr">
                      {formatCurrency(line.base_price)}
                    </td>
                    <td className="p-2 text-end" dir="ltr">
                      {formatNumber(line.discount_pct)}
                    </td>
                    <td className="p-2 text-end" dir="ltr">
                      {formatCurrency(line.net_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm font-semibold">
                <tr className="border-t border-black/10 dark:border-white/10">
                  <td className="p-2" colSpan={4}>
                    الإجمالي / الخصم / الصافي
                  </td>
                  <td className="p-2 text-end" dir="ltr">
                    {formatCurrency(invoice.gross_total)} / {formatCurrency(invoice.discount_total)}{' '}
                    / {formatCurrency(invoice.net_total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <SubmitCancelBar
          docStatus={invoice.doc_status}
          canAct={canAct}
          isPending={isPending}
          onSubmit={() => actions.submit.mutateAsync(invoice.$id)}
          onCancel={(reason) => actions.cancel.mutateAsync({ id: invoice.$id, reason })}
        />
        {invoice.doc_status === DocStatus.Submitted ? (
          <PostToLedgerPanel invoice={invoice} canAct={canAct} />
        ) : null}
        <p className="text-xs text-zinc-500">
          <Link to="/sales/invoices" className="underline">
            العودة إلى قائمة الفواتير
          </Link>
        </p>
      </Card>
    </div>
  )
}

function PostToLedgerPanel({ invoice, canAct }: { invoice: SalesInvoiceRow; canAct: boolean }) {
  const warehouses = useRepCustodyWarehouseOptions()
  const [picked, setPicked] = useState('')
  const options = warehouses.data ?? []
  const warehouseId = picked || (options.length === 1 && options[0] ? options[0].value : '')

  const mutation = useMutation<InvoiceLedgerPosting, AppError, string>({
    mutationFn: async (targetWarehouseId) => {
      const res = await postInvoiceToLedger(invoice, targetWarehouseId)
      if (!res.ok) throw res.error
      return res.value
    },
  })

  return (
    <div className="space-y-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
      <h3 className="text-sm font-semibold">الترحيل إلى الدفاتر / Post to ledgers (stock + GL)</h3>

      {warehouses.isError ? (
        <p className="text-xs text-red-600 dark:text-red-400">تعذّر تحميل مخازن عهدة المندوبين.</p>
      ) : (
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">
            مخزن عهدة المندوب / Rep custody warehouse
          </span>
          <select
            value={warehouseId}
            onChange={(e) => setPicked(e.target.value)}
            disabled={!canAct || warehouses.isLoading || mutation.isPending}
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          >
            <option value="" disabled>
              {warehouses.isLoading ? 'جارٍ التحميل…' : 'اختر مخزن العهدة…'}
            </option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <Button
        onClick={() => mutation.mutate(warehouseId)}
        disabled={!canAct || !warehouseId || mutation.isPending}
      >
        {mutation.isPending ? 'جارٍ الترحيل…' : 'ترحيل إلى الدفاتر'}
      </Button>

      {mutation.isError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {mutation.error.message}
        </p>
      ) : null}

      {mutation.isSuccess ? (
        <div className="space-y-1 text-xs">
          <p className="text-emerald-700 dark:text-emerald-400">
            {mutation.data.stockAlreadyPosted
              ? 'دفتر المخزون: سبق الترحيل.'
              : `دفتر المخزون: ${formatNumber(mutation.data.stock?.entries ?? 0)} حركة.`}
          </p>
          <p className="text-emerald-700 dark:text-emerald-400">
            {mutation.data.glAlreadyPosted
              ? 'دفتر الأستاذ: سبق الترحيل.'
              : `دفتر الأستاذ: ${formatNumber(mutation.data.gl?.entries ?? 0)} قيد.`}
          </p>
          {(mutation.data.stock?.balances ?? []).map((balance) => (
            <p
              key={`${balance.productId}-${balance.warehouseId}`}
              dir="ltr"
              className="text-zinc-500"
            >
              {balance.productId} @ {balance.warehouseId}: {formatNumber(balance.qtyAfter)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-40 shrink-0 text-zinc-500">{label}</span>
      <span>{children}</span>
    </div>
  )
}
