import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { formatCurrency, formatDate } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Button, PageHeader } from '@/shared/ui'

import { CAPITAL_WITHDRAWAL_METHOD_LABELS } from '../../domain/labels'
import type { CapitalWithdrawal } from '../../domain/schemas'
import { CapitalSummaryBar, DocStatusPill } from '../components'
import { useAccountingPermissions, useCapitalWithdrawalList } from '../hooks'

const PAGE_SIZE = 25

export function CapitalWithdrawalsPage() {
  const navigate = useNavigate()
  const perms = useAccountingPermissions()
  const [pageIndex, setPageIndex] = useState(0)

  const query = useCapitalWithdrawalList({ page: pageIndex, pageSize: PAGE_SIZE })

  const columns = useMemo<ColumnDef<CapitalWithdrawal>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع / Ref', accessor: (r) => r.reference_id },
      { id: 'withdrawn_by', header: 'المستفيد / Withdrawn by', accessor: (r) => r.withdrawn_by },
      {
        id: 'method',
        header: 'طريقة السحب / Method',
        accessor: (r) => r.method,
        cell: (r) => CAPITAL_WITHDRAWAL_METHOD_LABELS[r.method].ar,
      },
      {
        id: 'amount',
        header: 'القيمة / Amount',
        accessor: (r) => r.amount,
        align: 'end',
        cell: (r) => <span dir="ltr">{formatCurrency(r.amount)}</span>,
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
            onClick={() => navigate(`/accounting/capital-withdrawals/${r.$id}`)}
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
        title="سحب رأس المال"
        titleEn="Capital withdrawals"
        description="سحب المالك لأموال من الشركة — يُرحَّل قيد: مدين مسحوبات الملاك (حساب مقابل لرأس المال)، دائن حساب النقد/البنك. لا يُعدَّل رصيد رأس المال مباشرة أبدًا."
        actions={
          perms.canRecord ? (
            <Button onClick={() => navigate('/accounting/capital-withdrawals/new')}>
              + سحب من رأس المال
            </Button>
          ) : undefined
        }
      />

      <CapitalSummaryBar
        linkTo="/accounting/capital"
        linkLabel="إدخالات رأس المال"
        linkLabelEn="Capital contributions"
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
        emptyMessage="لا توجد سحوبات رأس مال بعد"
      />
    </div>
  )
}
