/**
 * Trial balance grid — one row per account plus a totals / balanced footer.
 * Presentation only; the parent supplies the computed `TrialBalance`.
 */
import { useMemo } from 'react'

import type { AppError } from '@/core/errors'
import { formatCurrency } from '@/shared/formatters'
import { DataTable, type ColumnDef } from '@/shared/data-table'
import { Badge } from '@/shared/ui'

import type { TrialBalance, TrialBalanceAccount } from '../../domain/gl'

export interface TrialBalanceTableProps {
  data?: TrialBalance
  isLoading?: boolean
  error?: AppError | null
  onRetry?: () => void
}

export function TrialBalanceTable({ data, isLoading, error, onRetry }: TrialBalanceTableProps) {
  const columns = useMemo<ColumnDef<TrialBalanceAccount>[]>(
    () => [
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
        id: 'balance',
        header: 'الرصيد / Balance',
        accessor: (r) => r.balance,
        align: 'end',
        cell: (r) => (
          <span dir="ltr" className="font-semibold">
            {formatCurrency(r.balance)}
          </span>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        getRowId={(row) => row.account}
        isLoading={isLoading}
        error={error ?? null}
        onRetry={onRetry}
        emptyMessage="لا توجد قيود في دفتر الأستاذ"
      />
      {data ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-zinc-900">
          <div className="flex gap-6" dir="ltr">
            <span>Σ مدين: {formatCurrency(data.totalDebit)}</span>
            <span>Σ دائن: {formatCurrency(data.totalCredit)}</span>
          </div>
          {data.balanced ? (
            <Badge tone="success">متوازن / Balanced</Badge>
          ) : (
            <Badge tone="danger">غير متوازن / Out of balance</Badge>
          )}
        </div>
      ) : null}
    </div>
  )
}
