/**
 * General-ledger entry grid. `DataTable` virtualizes automatically past ~100
 * rows. Filtering + pagination state is owned by the parent page; this
 * component just renders the columns and forwards an optional toolbar.
 */
import { useMemo, type ReactNode } from 'react'

import type { AppError } from '@/core/errors'
import { formatCurrency, formatDateTime } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'

import type { GlEntryRow } from '../../domain/schemas'

export interface GlEntryTableProps {
  rows: readonly GlEntryRow[]
  pagination?: PaginationState
  onPaginationChange?: (next: PaginationState) => void
  isLoading?: boolean
  error?: AppError | null
  onRetry?: () => void
  toolbar?: ReactNode
}

export function GlEntryTable({
  rows,
  pagination,
  onPaginationChange,
  isLoading,
  error,
  onRetry,
  toolbar,
}: GlEntryTableProps) {
  const columns = useMemo<ColumnDef<GlEntryRow>[]>(
    () => [
      {
        id: 'posting_datetime',
        header: 'التاريخ / Date',
        accessor: (r) => r.posting_datetime,
        cell: (r) => (
          <span dir="ltr" className="text-zinc-500">
            {formatDateTime(r.posting_datetime)}
          </span>
        ),
        width: 'minmax(9rem, 1fr)',
      },
      { id: 'voucher_no', header: 'السند / Voucher', accessor: (r) => r.voucher_no },
      { id: 'voucher_type', header: 'النوع / Type', accessor: (r) => r.voucher_type },
      { id: 'account', header: 'الحساب / Account', accessor: (r) => r.account },
      {
        id: 'debit',
        header: 'مدين / Debit',
        accessor: (r) => r.debit,
        align: 'end',
        cell: (r) => <span dir="ltr">{r.debit ? formatCurrency(r.debit) : '—'}</span>,
      },
      {
        id: 'credit',
        header: 'دائن / Credit',
        accessor: (r) => r.credit,
        align: 'end',
        cell: (r) => <span dir="ltr">{r.credit ? formatCurrency(r.credit) : '—'}</span>,
      },
      {
        id: 'is_cancelled',
        header: '',
        accessor: (r) => r.is_cancelled,
        align: 'end',
        width: '5rem',
        cell: (r) => (r.is_cancelled ? <span className="text-xs text-red-600">ملغى</span> : null),
      },
    ],
    [],
  )

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.$id}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      isLoading={isLoading}
      error={error ?? null}
      onRetry={onRetry}
      toolbar={toolbar}
      emptyMessage="لا توجد قيود مطابقة"
    />
  )
}
