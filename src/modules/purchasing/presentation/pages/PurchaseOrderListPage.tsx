/**
 * Purchase-order list: shared `DataTable` with server-side pagination / sort /
 * debounced search, `doc_status` filter tabs, and a "New PO" dialog.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import type { DocStatus } from '@/core/doc-status'
import { formatCurrency } from '@/shared/formatters'
import {
  DataTable,
  useDebouncedValue,
  type ColumnDef,
  type PaginationState,
  type SortState,
} from '@/shared/data-table'
import { Button, PageHeader } from '@/shared/ui'

import { canActOnPurchasing } from '../../domain/permissions'
import { PO_FIELD_LABELS, PURCHASING_LABELS, bilingual } from '../../domain/labels'
import type { PurchaseOrder } from '../../domain/schemas'
import { Dialog } from '../components/Dialog'
import { DocStatusPill } from '../components/DocStatusPill'
import { DocStatusTabs } from '../components/DocStatusTabs'
import { usePurchaseOrderList } from '../hooks/usePurchaseOrders'
import { useSupplierOptions } from '../hooks/usePickerOptions'
import { PurchaseOrderFormPage } from './PurchaseOrderFormPage'

const DEFAULT_PAGE_SIZE = 25

export function PurchaseOrderListPage() {
  const { principal } = useAuth()
  const canCreate = canActOnPurchasing(principal)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim())
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<SortState>(null)
  const [docStatus, setDocStatus] = useState<DocStatus | undefined>(undefined)
  const [dialogOpen, setDialogOpen] = useState(false)

  const query = usePurchaseOrderList({ search, pageIndex, pageSize, sort, docStatus })
  const suppliers = useSupplierOptions()

  const supplierNameById = useMemo(
    () => new Map((suppliers.data ?? []).map((option) => [option.value, option.label])),
    [suppliers.data],
  )

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(
    () => [
      {
        id: 'reference_id',
        header: bilingual(PO_FIELD_LABELS.reference_id!),
        accessor: (row) => row.reference_id,
        sortable: true,
        cell: (row) => (
          <Link
            to={`/purchasing/orders/${row.$id}`}
            className="font-mono text-sm font-semibold underline-offset-2 hover:underline"
          >
            {row.reference_id}
          </Link>
        ),
      },
      {
        id: 'supplier_id',
        header: bilingual(PO_FIELD_LABELS.supplier_id!),
        accessor: (row) => supplierNameById.get(row.supplier_id) ?? row.supplier_id,
      },
      {
        id: 'total_value',
        header: bilingual(PO_FIELD_LABELS.total_value!),
        accessor: (row) => row.total_value,
        align: 'end',
        sortable: true,
        cell: (row) => <span dir="ltr">{formatCurrency(row.total_value ?? 0)}</span>,
      },
      {
        id: 'doc_status',
        header: bilingual(PO_FIELD_LABELS.doc_status!),
        accessor: (row) => row.doc_status,
        align: 'center',
        cell: (row) => <DocStatusPill status={row.doc_status} />,
      },
    ],
    [supplierNameById],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={PURCHASING_LABELS.purchaseOrder.many.ar}
        titleEn={PURCHASING_LABELS.purchaseOrder.many.en}
        actions={
          canCreate ? <Button onClick={() => setDialogOpen(true)}>+ أمر شراء جديد</Button> : null
        }
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
        sort={sort}
        onSortChange={(next) => {
          setSort(next)
          setPageIndex(0)
        }}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد أوامر شراء"
        toolbar={
          <input
            type="search"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setPageIndex(0)
            }}
            placeholder="ابحث برقم المرجع…"
            className="w-full max-w-xs rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          />
        }
      />

      <Dialog
        open={dialogOpen}
        title="أمر شراء جديد"
        titleEn="New purchase order"
        onClose={() => setDialogOpen(false)}
      >
        <PurchaseOrderFormPage mode="create" onDone={() => setDialogOpen(false)} />
      </Dialog>
    </div>
  )
}
