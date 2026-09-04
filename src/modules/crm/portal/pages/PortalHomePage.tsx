import { Link } from 'react-router-dom'

import type { PortalInvoiceListItem } from '@/infrastructure/appwrite/functions'
import { formatCurrency, formatDate } from '@/shared/formatters'
import { Card } from '@/shared/ui'

import { usePortalAuth } from '../auth/portal-context'
import { PortalDocStatusBadge } from '../components/PortalDocStatusBadge'
import { portalPaymentMethodLabel } from '../labels'
import { usePortalInvoices } from '../hooks'

const RECENT_COUNT = 5

export function PortalHomePage() {
  const { customer } = usePortalAuth()
  const query = usePortalInvoices({ page: 0, pageSize: RECENT_COUNT })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">
          مرحبًا{customer ? `، ${customer.name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">كود العميل: {customer?.code ?? '—'}</p>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">أحدث الفواتير</h2>
          <Link to="/portal/invoices" className="text-xs underline">
            عرض كل الفواتير
          </Link>
        </div>

        <RecentInvoices
          isLoading={query.isLoading}
          isError={query.isError}
          rows={query.data?.rows ?? []}
        />
      </Card>
    </div>
  )
}

function RecentInvoices({
  isLoading,
  isError,
  rows,
}: {
  isLoading: boolean
  isError: boolean
  rows: ReadonlyArray<PortalInvoiceListItem>
}) {
  if (isLoading) return <p className="text-sm text-zinc-500">جارٍ التحميل…</p>
  if (isError) return <p className="text-sm text-red-600 dark:text-red-400">تعذّر تحميل الفواتير.</p>
  if (rows.length === 0) return <p className="text-sm text-zinc-500">لا توجد فواتير بعد.</p>

  return (
    <ul className="divide-y divide-black/5 text-sm dark:divide-white/5">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 py-2">
          <Link to={`/portal/invoices/${row.id}`} className="min-w-0 truncate underline">
            {row.referenceId}
          </Link>
          <span className="shrink-0 text-zinc-500">{portalPaymentMethodLabel(row.paymentMethod)}</span>
          <span dir="ltr" className="shrink-0 tabular-nums">
            {formatCurrency(row.netTotal)}
          </span>
          <span dir="ltr" className="shrink-0 text-xs text-zinc-400">
            {formatDate(row.postingDatetime)}
          </span>
          <PortalDocStatusBadge status={row.docStatus} />
        </li>
      ))}
    </ul>
  )
}
