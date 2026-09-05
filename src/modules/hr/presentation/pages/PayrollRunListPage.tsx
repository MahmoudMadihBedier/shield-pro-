/**
 * Payroll-run list: shared `DataTable` with `doc_status` filter tabs. "New
 * run" is gated to the roles allowed to submit `payroll_runs`
 * (`SUBMIT_ROLE_BY_TABLE`) since only they can meaningfully carry a Draft to
 * completion.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { canSubmitTable } from '@/core/access'
import { DocStatus } from '@/core/doc-status'
import { formatCurrency, formatDate } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Button, PageHeader } from '@/shared/ui'

import type { PayrollRunRow } from '../../domain/schemas'
import { DocStatusPill, DocStatusTabs } from '../components'
import { usePayrollRunList } from '../hooks'

const DEFAULT_PAGE_SIZE = 25

export function PayrollRunListPage() {
  const navigate = useNavigate()
  const { principal } = useAuth()
  const canCreate = Boolean(principal && canSubmitTable(principal.roles, 'payroll_runs'))

  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [docStatus, setDocStatus] = useState<DocStatus | undefined>(undefined)

  const query = usePayrollRunList({ page: pageIndex, pageSize, docStatus })

  const columns = useMemo<ColumnDef<PayrollRunRow>[]>(
    () => [
      {
        id: 'reference_id',
        header: 'المرجع / Reference',
        accessor: (row) => row.reference_id,
        cell: (row) => (
          <button
            type="button"
            onClick={() => navigate(`/hr/payroll/${row.$id}`)}
            className="font-mono text-sm font-semibold underline-offset-2 hover:underline"
          >
            {row.reference_id}
          </button>
        ),
      },
      {
        id: 'period',
        header: 'الفترة / Period',
        accessor: (row) => row.pay_period_start,
        cell: (row) => (
          <span dir="ltr" className="text-sm">
            {formatDate(row.pay_period_start)} – {formatDate(row.pay_period_end)}
          </span>
        ),
      },
      {
        id: 'total_net_pay',
        header: 'الإجمالي / Total',
        accessor: (row) => row.total_net_pay,
        align: 'end',
        cell: (row) => <span dir="ltr">{formatCurrency(row.total_net_pay)}</span>,
      },
      {
        id: 'doc_status',
        header: 'الحالة / Status',
        accessor: (row) => row.doc_status,
        align: 'center',
        cell: (row) => <DocStatusPill status={row.doc_status} />,
      },
    ],
    [navigate],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="الرواتب"
        titleEn="Payroll"
        actions={canCreate ? <Button onClick={() => navigate('/hr/payroll/new')}>+ مسير رواتب جديد</Button> : null}
      />

      <DocStatusTabs
        value={docStatus}
        onChange={(next) => {
          setDocStatus(next)
          setPageIndex(0)
        }}
      />

      <DataTable
        columns={columns}
        rows={query.data?.rows ?? []}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize, total: query.data?.total ?? 0 }}
        onPaginationChange={(next: PaginationState) => {
          setPageIndex(next.pageIndex)
          setPageSize(next.pageSize)
        }}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد مسيرات رواتب"
      />
    </div>
  )
}
