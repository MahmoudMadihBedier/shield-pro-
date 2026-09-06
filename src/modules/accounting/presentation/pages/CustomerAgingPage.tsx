import { useMemo, useState } from 'react'

import { formatCurrency, formatDate } from '@/shared/formatters'
import { ExportButton } from '@/shared/excel'
import { Card, PageHeader } from '@/shared/ui'

import { RECEIVABLE_INVOICE_METHODS } from '../../domain/aging'
import { AgingTable } from '../components'
import { useCustomerAging, useCustomerLedger } from '../hooks'

const AGING_EXPORT_COLUMNS = [
  { key: 'customer', header: 'العميل / Customer' },
  { key: 'outstanding', header: 'المستحق / Outstanding' },
  { key: 'creditLimit', header: 'حد الائتمان / Credit limit' },
  { key: 'b0', header: '0-30' },
  { key: 'b1', header: '31-60' },
  { key: 'b2', header: '61-90' },
  { key: 'b3', header: '90+' },
  { key: 'oldestDays', header: 'أقدم دين (يوم) / Oldest days' },
] as const

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function CustomerAgingPage() {
  const [asOfInput, setAsOfInput] = useState(todayIso)
  const asOf = useMemo(() => new Date(`${asOfInput}T23:59:59.999Z`), [asOfInput])
  const [drillCustomer, setDrillCustomer] = useState<string | undefined>()

  const aging = useCustomerAging(asOf)
  const ledger = useCustomerLedger(drillCustomer)
  const drillRow = (aging.data ?? []).find((r) => r.customerId === drillCustomer)

  const exportRows = useMemo(
    () =>
      (aging.data ?? []).map((r) => ({
        customer: r.customerName,
        outstanding: r.outstanding,
        creditLimit: r.creditLimit,
        b0: r.buckets['0-30'],
        b1: r.buckets['31-60'],
        b2: r.buckets['61-90'],
        b3: r.buckets['90+'],
        oldestDays: r.oldestDays,
      })),
    [aging.data],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="أعمار الديون"
        titleEn="Customer aging"
        description="الفواتير المعتمدة الائتمانية فقط (credit / partial / post-dated cheque)."
        actions={
          <ExportButton
            rows={exportRows}
            columns={AGING_EXPORT_COLUMNS}
            fileName={`customer-aging-${asOfInput}`}
          />
        }
      />

      <Card className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">حتى تاريخ / As of</span>
          <input
            type="date"
            dir="ltr"
            value={asOfInput}
            max={todayIso()}
            onChange={(e) => setAsOfInput(e.target.value || todayIso())}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </label>
        <p className="text-xs text-zinc-400">
          تحتسب الفترات من تاريخ الفاتورة. طرق الدفع المشمولة:{' '}
          {RECEIVABLE_INVOICE_METHODS.join('، ')}.
        </p>
      </Card>

      <AgingTable
        rows={aging.data ?? []}
        isLoading={aging.isLoading}
        error={aging.isError ? aging.error : null}
        onRetry={() => void aging.refetch()}
        onDrillIn={setDrillCustomer}
      />

      {drillCustomer ? (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">
              تفصيل: {drillRow?.customerName ?? drillCustomer}
              {drillRow ? (
                <span className="ms-2 text-sm text-zinc-500" dir="ltr">
                  {formatCurrency(drillRow.outstanding)} — حد الائتمان{' '}
                  {formatCurrency(drillRow.creditLimit)}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setDrillCustomer(undefined)}
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              إغلاق
            </button>
          </div>

          {ledger.isLoading ? <p className="text-sm text-zinc-500">جارٍ التحميل…</p> : null}
          {ledger.isError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{ledger.error.message}</p>
          ) : null}

          {ledger.data ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-xs text-zinc-400">الفواتير / Invoices</div>
                <ul className="space-y-1 text-sm">
                  {ledger.data.invoices.length === 0 ? (
                    <li className="text-zinc-500">لا يوجد</li>
                  ) : (
                    ledger.data.invoices.map((inv) => (
                      <li key={inv.$id} className="flex justify-between">
                        <span dir="ltr">{inv.reference_id}</span>
                        <span className="text-zinc-500" dir="ltr">
                          {formatDate(inv.posting_datetime)}
                        </span>
                        <span dir="ltr">{formatCurrency(inv.net_total)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <div className="mb-1 text-xs text-zinc-400">التحصيلات / Receipts</div>
                <ul className="space-y-1 text-sm">
                  {ledger.data.receipts.length === 0 ? (
                    <li className="text-zinc-500">لا يوجد</li>
                  ) : (
                    ledger.data.receipts.map((rec) => (
                      <li key={rec.$id} className="flex justify-between">
                        <span dir="ltr">{rec.reference_id}</span>
                        <span className="text-zinc-500" dir="ltr">
                          {formatDate(rec.posting_datetime)}
                        </span>
                        <span dir="ltr">{formatCurrency(rec.amount)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
