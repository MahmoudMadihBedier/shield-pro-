import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { docStatusLabel } from '@/core/doc-status'
import { formatDate } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import type { StockCountSessionRow } from '../../domain/schemas'
import {
  optionLabelMap,
  useInventoryPermissions,
  useStockCountSessionActions,
  useStockCountSessionList,
  useWarehouseOptions,
} from '../hooks'
import { COUNT_STATUS_LABEL, COUNT_STATUS_TONE } from '../labels'

const PAGE_SIZE = 25

export function StockCountSessionListPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [pageIndex, setPageIndex] = useState(0)
  const [newWarehouse, setNewWarehouse] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const warehouses = useWarehouseOptions()
  const warehouseLabel = useMemo(() => optionLabelMap(warehouses.data), [warehouses.data])

  const query = useStockCountSessionList({ page: pageIndex, pageSize: PAGE_SIZE })
  const { createDraft } = useStockCountSessionActions()

  const columns = useMemo<ColumnDef<StockCountSessionRow>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع / Ref', accessor: (r) => r.reference_id },
      {
        id: 'warehouse',
        header: 'المخزن / Warehouse',
        accessor: (r) => r.warehouse_id,
        cell: (r) => warehouseLabel.get(r.warehouse_id) ?? r.warehouse_id,
      },
      {
        id: 'status',
        header: 'الحالة / Status',
        accessor: (r) => r.status,
        cell: (r) => <Badge tone={COUNT_STATUS_TONE[r.status]}>{COUNT_STATUS_LABEL[r.status]}</Badge>,
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
          <Button size="sm" variant="secondary" onClick={() => navigate(`/inventory/counts/${r.$id}`)}>
            فتح
          </Button>
        ),
      },
    ],
    [navigate, warehouseLabel],
  )

  const startSession = async () => {
    if (!newWarehouse) return
    setCreateError(null)
    try {
      const row = await createDraft.mutateAsync({
        fields: { warehouse_id: newWarehouse, counts: '[]', status: 'open' },
      })
      navigate(`/inventory/counts/${row.$id}`)
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'تعذّر بدء جلسة الجرد.')
    }
  }

  const rows = query.data?.rows ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader title="الجرد" titleEn="Stock counts" />

      {perms.canRequest ? (
        <Card className="flex flex-wrap items-end gap-2">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">مخزن الجرد / Warehouse</span>
            <select
              value={newWarehouse}
              onChange={(e) => setNewWarehouse(e.target.value)}
              className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
            >
              <option value="">اختر مخزنًا…</option>
              {(warehouses.data ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={!newWarehouse || createDraft.isPending} onClick={() => void startSession()}>
            بدء جلسة جرد
          </Button>
          {createError ? <span className="text-sm text-red-600">{createError}</span> : null}
        </Card>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, total }}
        onPaginationChange={(next: PaginationState) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد جلسات جرد بعد"
      />
    </div>
  )
}
