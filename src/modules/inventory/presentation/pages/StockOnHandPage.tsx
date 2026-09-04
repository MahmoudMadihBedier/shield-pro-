/**
 * Read-only "stock on hand" — the `bin_balances` projection in a `DataTable`.
 * Visible to warehouse + accountant + admin roles. The table virtualises itself
 * past ~100 rows (shared `DataTable`).
 */
import { useMemo, useState } from 'react'

import { formatDateTime, formatNumber } from '@/shared/formatters'
import { DataTable, useDebouncedValue, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { PageHeader } from '@/shared/ui'

import {
  optionLabelMap,
  useBinBalances,
  useProductOptions,
  useWarehouseOptions,
  type BinBalance,
} from '../hooks'

const PAGE_SIZE = 100

export function StockOnHandPage() {
  const [warehouseId, setWarehouseId] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim())
  const [pageIndex, setPageIndex] = useState(0)

  const warehouses = useWarehouseOptions()
  const products = useProductOptions()

  const warehouseLabel = useMemo(() => optionLabelMap(warehouses.data), [warehouses.data])
  const productLabel = useMemo(() => optionLabelMap(products.data), [products.data])

  const query = useBinBalances({
    warehouseId: warehouseId || undefined,
    search: search || undefined,
    page: pageIndex,
    pageSize: PAGE_SIZE,
  })

  const columns = useMemo<ColumnDef<BinBalance>[]>(
    () => [
      {
        id: 'product',
        header: 'الصنف / Product',
        accessor: (row) => row.product_id,
        cell: (row) => productLabel.get(row.product_id) ?? row.product_id,
      },
      {
        id: 'warehouse',
        header: 'المخزن / Warehouse',
        accessor: (row) => row.warehouse_id,
        cell: (row) => warehouseLabel.get(row.warehouse_id) ?? row.warehouse_id,
      },
      {
        id: 'qty',
        header: 'الرصيد / Qty',
        accessor: (row) => row.qty,
        align: 'end',
        cell: (row) => (
          <span dir="ltr" className="tabular-nums">
            {formatNumber(row.qty)}
          </span>
        ),
      },
      {
        id: 'updated',
        header: 'آخر تحديث / Updated',
        accessor: (row) => row.updated_datetime,
        align: 'end',
        cell: (row) => (
          <span dir="ltr" className="text-zinc-500">
            {formatDateTime(row.updated_datetime)}
          </span>
        ),
      },
    ],
    [productLabel, warehouseLabel],
  )

  const rows = query.data?.rows ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader title="الرصيد الحالي" titleEn="Stock on hand" />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, total }}
        onPaginationChange={(next: PaginationState) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد أرصدة مطابقة"
        toolbar={
          <div className="flex flex-wrap gap-2">
            <select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value)
                setPageIndex(0)
              }}
              className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
            >
              <option value="">كل المخازن</option>
              {(warehouses.data ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setPageIndex(0)
              }}
              placeholder="تصفية بمعرّف الصنف…"
              className="w-full max-w-xs rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
            />
          </div>
        }
      />
    </div>
  )
}
