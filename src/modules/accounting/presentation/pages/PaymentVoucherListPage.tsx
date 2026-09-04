import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { formatCurrency, formatDate } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Button, PageHeader } from '@/shared/ui'

import { VOUCHER_DIRECTION_LABELS } from '../../domain/labels'
import type { PaymentVoucher } from '../../domain/schemas'
import { DocStatusPill } from '../components'
import { useAccountingPermissions, usePaymentVoucherList } from '../hooks'

const PAGE_SIZE = 25

export function PaymentVoucherListPage() {
  const navigate = useNavigate()
  const perms = useAccountingPermissions()
  const [pageIndex, setPageIndex] = useState(0)

  const query = usePaymentVoucherList({ page: pageIndex, pageSize: PAGE_SIZE })

  const columns = useMemo<ColumnDef<PaymentVoucher>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع / Ref', accessor: (r) => r.reference_id },
      {
        id: 'direction',
        header: 'النوع / Direction',
        accessor: (r) => r.direction,
        cell: (r) => VOUCHER_DIRECTION_LABELS[r.direction].ar,
      },
      {
        id: 'amount',
        header: 'المبلغ / Amount',
        accessor: (r) => r.amount,
        align: 'end',
        cell: (r) => <span dir="ltr">{formatCurrency(r.amount)}</span>,
      },
      {
        id: 'counterparty',
        header: 'الطرف / Counterparty',
        accessor: (r) => r.counterparty ?? '—',
      },
      {
        id: 'doc_status',
        header: 'الحالة / Status',
        accessor: (r) => r.doc_status,
        cell: (r) => <DocStatusPill status={r.doc_status} />,
      },
      {
        id: 'posting',
        header: 'التاريخ / Date',
        accessor: (r) => r.posting_datetime,
        align: 'end',
        cell: (r) => (
          <span dir="ltr" className="text-zinc-500">
            {formatDate(r.posting_datetime)}
          </span>
        ),
      },
      {
        id: '__actions',
        header: '',
        accessor: () => null,
        align: 'end',
        width: '7rem',
        cell: (r) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/accounting/vouchers/${r.$id}`)}
          >
            فتح
          </Button>
        ),
      },
    ],
    [navigate],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="سندات الصرف والقبض"
        titleEn="Payment vouchers"
        actions={
          perms.canRecord ? (
            <Button onClick={() => navigate('/accounting/vouchers/new')}>+ سند جديد</Button>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        rows={query.data?.rows ?? []}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, total: query.data?.total ?? 0 }}
        onPaginationChange={(next: PaginationState) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد سندات بعد"
      />
    </div>
  )
}
