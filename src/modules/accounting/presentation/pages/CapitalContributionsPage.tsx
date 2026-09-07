import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { formatCurrency, formatDate } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Button, PageHeader } from '@/shared/ui'

import { CAPITAL_ASSET_TYPE_LABELS } from '../../domain/labels'
import type { CapitalContribution } from '../../domain/schemas'
import { DocStatusPill } from '../components'
import { useAccountingPermissions, useCapitalContributionList } from '../hooks'

const PAGE_SIZE = 25

export function CapitalContributionsPage() {
  const navigate = useNavigate()
  const perms = useAccountingPermissions()
  const [pageIndex, setPageIndex] = useState(0)

  const query = useCapitalContributionList({ page: pageIndex, pageSize: PAGE_SIZE })

  const columns = useMemo<ColumnDef<CapitalContribution>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع / Ref', accessor: (r) => r.reference_id },
      { id: 'contributor', header: 'المساهم / Contributor', accessor: (r) => r.contributor },
      {
        id: 'asset_type',
        header: 'نوع الأصل / Asset',
        accessor: (r) => r.asset_type,
        cell: (r) => CAPITAL_ASSET_TYPE_LABELS[r.asset_type].ar,
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
            onClick={() => navigate(`/accounting/capital/${r.$id}`)}
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
        title="رأس المال"
        titleEn="Capital contributions"
        description="إدخال رأس مال المالك — نقدًا أو أصولًا قائمة (سيارة، عقار، معدات). عند الاعتماد يُرحَّل قيد: مدين حساب الأصل، دائن رأس المال."
        actions={
          perms.canRecord ? (
            <Button onClick={() => navigate('/accounting/capital/new')}>+ إدخال رأس مال</Button>
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
        emptyMessage="لا توجد إدخالات رأس مال بعد"
      />
    </div>
  )
}
