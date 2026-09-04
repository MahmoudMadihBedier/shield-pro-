import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { PortalInvoiceListItem } from '@/infrastructure/appwrite/functions'
import { formatCurrency, formatDate } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Button, PageHeader } from '@/shared/ui'

import { PortalDocStatusBadge } from '../components/PortalDocStatusBadge'
import { usePortalInvoices } from '../hooks'
import { portalPaymentMethodLabel } from '../labels'

const PAGE_SIZE = 25

export function PortalInvoicesPage() {
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)

  const query = usePortalInvoices({ page: pageIndex, pageSize: PAGE_SIZE })

  const columns: ColumnDef<PortalInvoiceListItem>[] = [
    { id: 'reference_id', header: 'المرجع', accessor: (r) => r.referenceId },
    {
      id: 'payment_method',
      header: 'طريقة الدفع',
      accessor: (r) => r.paymentMethod,
      cell: (r) => portalPaymentMethodLabel(r.paymentMethod),
    },
    {
      id: 'net_total',
      header: 'الصافي',
      accessor: (r) => r.netTotal,
      align: 'end',
      cell: (r) => (
        <span dir="ltr" className="tabular-nums">
          {formatCurrency(r.netTotal)}
        </span>
      ),
    },
    {
      id: 'doc_status',
      header: 'الحالة',
      accessor: (r) => r.docStatus,
      cell: (r) => <PortalDocStatusBadge status={r.docStatus} />,
    },
    {
      id: 'posting',
      header: 'التاريخ',
      accessor: (r) => r.postingDatetime,
      align: 'end',
      cell: (r) => (
        <span dir="ltr" className="text-zinc-500">
          {formatDate(r.postingDatetime)}
        </span>
      ),
    },
    {
      id: '__actions',
      header: '',
      accessor: () => null,
      align: 'end',
      width: '6rem',
      cell: (r) => (
        <Button size="sm" variant="secondary" onClick={() => navigate(`/portal/invoices/${r.id}`)}>
          فتح
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="الفواتير" description="جميع فواتيرك مع شيلد برو" />

      <DataTable
        columns={columns}
        rows={query.data?.rows ?? []}
        getRowId={(row) => row.id}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, total: query.data?.total ?? 0 }}
        onPaginationChange={(next: PaginationState) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد فواتير"
      />
    </div>
  )
}
