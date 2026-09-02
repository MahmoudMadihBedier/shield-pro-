/**
 * Stock-receipt list: shared `DataTable` with server-side pagination / sort /
 * debounced search, `doc_status` filter tabs, and a "New receipt" dialog. Opens
 * the dialog pre-filled when navigated to from a PO detail page.
 */
import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import type { DocStatus } from '@/core/doc-status'
import {
  DataTable,
  useDebouncedValue,
  type ColumnDef,
  type PaginationState,
  type SortState,
} from '@/shared/data-table'
import { Button, PageHeader } from '@/shared/ui'

import { RECEIPT_FIELD_LABELS, PURCHASING_LABELS, bilingual } from '../../domain/labels'
import { canActOnPurchasing } from '../../domain/permissions'
import type { StockReceipt } from '../../domain/schemas'
import { Dialog } from '../components/Dialog'
import { DocStatusPill } from '../components/DocStatusPill'
import { DocStatusTabs } from '../components/DocStatusTabs'
import { useStockReceiptList } from '../hooks/useStockReceipts'
import { StockReceiptFormPage } from './StockReceiptFormPage'

const DEFAULT_PAGE_SIZE = 25

interface ReceiptsLocationState {
  poRef?: string
}

export function StockReceiptListPage() {
  const { principal } = useAuth()
  const canCreate = canActOnPurchasing(principal)
  const location = useLocation()
  const incomingPoRef = (location.state as ReceiptsLocationState | null)?.poRef

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim())
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<SortState>(null)
  const [docStatus, setDocStatus] = useState<DocStatus | undefined>(undefined)
  // Opened straight away when arriving from a PO detail page ("Create receipt").
  const [dialogOpen, setDialogOpen] = useState(Boolean(incomingPoRef))

  const query = useStockReceiptList({ search, pageIndex, pageSize, sort, docStatus })

  const columns = useMemo<ColumnDef<StockReceipt>[]>(
    () => [
      {
        id: 'reference_id',
        header: bilingual(RECEIPT_FIELD_LABELS.reference_id!),
        accessor: (row) => row.reference_id,
        sortable: true,
        cell: (row) => (
          <Link
            to={`/purchasing/receipts/${row.$id}`}
            className="font-mono text-sm font-semibold underline-offset-2 hover:underline"
          >
            {row.reference_id}
          </Link>
        ),
      },
      {
        id: 'purchase_order_ref',
        header: bilingual(RECEIPT_FIELD_LABELS.purchase_order_ref!),
        accessor: (row) => row.purchase_order_ref,
      },
      {
        id: 'supplier_lot_number',
        header: bilingual(RECEIPT_FIELD_LABELS.supplier_lot_number!),
        accessor: (row) => row.supplier_lot_number ?? '',
      },
      {
        id: 'doc_status',
        header: bilingual(RECEIPT_FIELD_LABELS.doc_status!),
        accessor: (row) => row.doc_status,
        align: 'center',
        cell: (row) => <DocStatusPill status={row.doc_status} />,
      },
    ],
    [],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title={PURCHASING_LABELS.stockReceipt.many.ar}
        titleEn={PURCHASING_LABELS.stockReceipt.many.en}
        actions={
          canCreate ? <Button onClick={() => setDialogOpen(true)}>+ إذن استلام جديد</Button> : null
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
        emptyMessage="لا توجد أذون استلام"
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
        title="إذن استلام خامات جديد"
        titleEn="New raw-material receipt"
        onClose={() => setDialogOpen(false)}
      >
        <StockReceiptFormPage onDone={() => setDialogOpen(false)} initialPoRef={incomingPoRef} />
      </Dialog>
    </div>
  )
}
