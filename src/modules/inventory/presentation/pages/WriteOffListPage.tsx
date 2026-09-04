import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { docStatusLabel } from '@/core/doc-status'
import { formatDate } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Button, PageHeader } from '@/shared/ui'

import type { WriteOffRow } from '../../domain/schemas'
import { optionLabelMap, useWarehouseOptions, useWriteOffList } from '../hooks'
import { WRITE_OFF_KIND_LABEL } from '../labels'

const PAGE_SIZE = 25

export function WriteOffListPage() {
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)

  const warehouses = useWarehouseOptions()
  const warehouseLabel = useMemo(() => optionLabelMap(warehouses.data), [warehouses.data])

  const query = useWriteOffList({ page: pageIndex, pageSize: PAGE_SIZE })

  const columns = useMemo<ColumnDef<WriteOffRow>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع / Ref', accessor: (r) => r.reference_id },
      {
        id: 'warehouse',
        header: 'المخزن / Warehouse',
        accessor: (r) => r.warehouse_id,
        cell: (r) => warehouseLabel.get(r.warehouse_id) ?? r.warehouse_id,
      },
      {
        id: 'kind',
        header: 'النوع / Kind',
        accessor: (r) => r.kind,
        cell: (r) => WRITE_OFF_KIND_LABEL[r.kind],
      },
      {
        id: 'doc_status',
        header: 'المستند / Doc',
        accessor: (r) => r.doc_status,
        cell: (r) => docStatusLabel(r.doc_status),
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
        width: '8rem',
        cell: (r) => (
          <Button size="sm" variant="secondary" onClick={() => navigate(`/inventory/write-offs/${r.$id}`)}>
            فتح
          </Button>
        ),
      },
    ],
    [navigate, warehouseLabel],
  )

  const rows = query.data?.rows ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="الهالك"
        titleEn="Write-offs"
        actions={<Button onClick={() => navigate('/inventory/write-offs/new')}>+ هالك جديد</Button>}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, total }}
        onPaginationChange={(next: PaginationState) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا يوجد هالك مُسجّل بعد"
      />
    </div>
  )
}
