/**
 * Customer × aging-bucket grid. Presentation only — the parent owns the data
 * (from `useCustomerAging`) and the drill-in handler.
 */
import { useMemo } from 'react'

import type { AppError } from '@/core/errors'
import { formatCurrency } from '@/shared/formatters'
import { DataTable, type ColumnDef } from '@/shared/data-table'
import { Button } from '@/shared/ui'

import type { CustomerAgingRow } from '../../data/aging-repo'
import { AGING_BUCKET_LABELS, AGING_BUCKET_ORDER } from '../../domain/labels'

export interface AgingTableProps {
  rows: readonly CustomerAgingRow[]
  isLoading?: boolean
  error?: AppError | null
  onRetry?: () => void
  onDrillIn?: (customerId: string) => void
}

export function AgingTable({ rows, isLoading, error, onRetry, onDrillIn }: AgingTableProps) {
  const columns = useMemo<ColumnDef<CustomerAgingRow>[]>(() => {
    const bucketColumns: ColumnDef<CustomerAgingRow>[] = AGING_BUCKET_ORDER.map((bucket) => ({
      id: bucket,
      header: AGING_BUCKET_LABELS[bucket].ar,
      accessor: (r) => r.buckets[bucket],
      align: 'end',
      cell: (r) => (
        <span dir="ltr">{r.buckets[bucket] ? formatCurrency(r.buckets[bucket]) : '—'}</span>
      ),
    }))

    return [
      {
        id: 'customer',
        header: 'العميل / Customer',
        accessor: (r) => r.customerName,
        width: 'minmax(10rem, 1.4fr)',
      },
      ...bucketColumns,
      {
        id: 'outstanding',
        header: 'الإجمالي / Outstanding',
        accessor: (r) => r.outstanding,
        align: 'end',
        cell: (r) => (
          <span dir="ltr" className="font-semibold">
            {formatCurrency(r.outstanding)}
          </span>
        ),
      },
      {
        id: 'oldest',
        header: 'أقدم دين / Oldest',
        accessor: (r) => r.oldestDays,
        align: 'end',
        cell: (r) => <span dir="ltr">{r.oldestDays ? `${r.oldestDays} يوم` : '—'}</span>,
      },
      {
        id: '__actions',
        header: '',
        accessor: () => null,
        align: 'end',
        width: '7rem',
        cell: (r) =>
          onDrillIn ? (
            <Button size="sm" variant="secondary" onClick={() => onDrillIn(r.customerId)}>
              تفصيل
            </Button>
          ) : null,
      },
    ]
  }, [onDrillIn])

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.customerId}
      isLoading={isLoading}
      error={error ?? null}
      onRetry={onRetry}
      emptyMessage="لا توجد أرصدة مستحقة على العملاء"
    />
  )
}
