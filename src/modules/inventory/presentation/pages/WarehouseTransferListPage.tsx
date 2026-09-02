import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { docStatusLabel } from '@/core/doc-status'
import { formatDate } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Badge, Button, PageHeader } from '@/shared/ui'

import type { WarehouseTransferRow } from '../../domain/schemas'
import { optionLabelMap, useWarehouseOptions, useWarehouseTransferList } from '../hooks'
import { TRANSFER_STATUS_LABEL, TRANSFER_STATUS_TONE } from '../labels'

const PAGE_SIZE = 25

export function WarehouseTransferListPage() {
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)

  const warehouses = useWarehouseOptions()
  const warehouseLabel = useMemo(() => optionLabelMap(warehouses.data), [warehouses.data])

  const query = useWarehouseTransferList({ page: pageIndex, pageSize: PAGE_SIZE })

  const columns = useMemo<ColumnDef<WarehouseTransferRow>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع / Ref', accessor: (r) => r.reference_id },
      {
        id: 'from',
        header: 'من / From',
        accessor: (r) => r.from_warehouse_id,
        cell: (r) => warehouseLabel.get(r.from_warehouse_id) ?? r.from_warehouse_id,
      },
      {
        id: 'to',
        header: 'إلى / To',
        accessor: (r) => r.to_warehouse_id,
        cell: (r) => warehouseLabel.get(r.to_warehouse_id) ?? r.to_warehouse_id,
      },
      {
        id: 'status',
        header: 'حالة المسار / Flow',
        accessor: (r) => r.status,
        cell: (r) => <Badge tone={TRANSFER_STATUS_TONE[r.status]}>{TRANSFER_STATUS_LABEL[r.status]}</Badge>,
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
          <Button size="sm" variant="secondary" onClick={() => navigate(`/inventory/transfers/${r.$id}`)}>
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
        title="التحويلات"
        titleEn="Warehouse transfers"
        actions={<Button onClick={() => navigate('/inventory/transfers/new')}>+ تحويل جديد</Button>}
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
        emptyMessage="لا توجد تحويلات بعد"
      />
    </div>
  )
}
