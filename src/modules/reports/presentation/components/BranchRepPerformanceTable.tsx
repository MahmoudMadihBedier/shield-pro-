/**
 * A `DataTable` over either branch or rep performance — same two columns
 * (name, revenue, invoice count), so one generic component serves both
 * dashboard tables.
 */
import { useMemo } from 'react'

import { formatCurrency, formatNumber } from '@/shared/formatters'
import { DataTable, type ColumnDef } from '@/shared/data-table'

export interface PerformanceRow {
  id: string
  name: string
  netRevenue: number
  invoiceCount: number
}

export interface BranchRepPerformanceTableProps {
  rows: readonly PerformanceRow[]
  nameHeader: string
  emptyMessage: string
  isLoading?: boolean
}

export function BranchRepPerformanceTable({
  rows,
  nameHeader,
  emptyMessage,
  isLoading,
}: BranchRepPerformanceTableProps) {
  const columns = useMemo<ColumnDef<PerformanceRow>[]>(
    () => [
      { id: 'name', header: nameHeader, accessor: (r) => r.name },
      {
        id: 'invoiceCount',
        header: 'عدد الفواتير / Invoices',
        accessor: (r) => r.invoiceCount,
        align: 'end',
        cell: (r) => (
          <span dir="ltr" className="tabular-nums">
            {formatNumber(r.invoiceCount)}
          </span>
        ),
      },
      {
        id: 'netRevenue',
        header: 'صافي المبيعات / Net revenue',
        accessor: (r) => r.netRevenue,
        align: 'end',
        cell: (r) => (
          <span dir="ltr" className="font-semibold">
            {formatCurrency(r.netRevenue)}
          </span>
        ),
      },
    ],
    [nameHeader],
  )

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
    />
  )
}
