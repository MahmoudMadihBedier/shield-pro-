/**
 * Bank statement lines (Plan §4.1) — imported via `/admin/import` (System
 * Admin), reconciled here (System Admin / Chief Accountant). No auto-matching
 * against receipts/payment vouchers in v1 — a manual reconciled toggle only.
 */
import { useMemo, useState } from 'react'

import { formatCurrency, formatDate } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import type { BankStatementLine } from '../../domain/bank-statement'
import { useAccountingPermissions, useBankStatementList, useReconcileBankStatementLine } from '../hooks'

const PAGE_SIZE = 25

export function BankStatementPage() {
  const perms = useAccountingPermissions()
  const [pageIndex, setPageIndex] = useState(0)
  const [reconciledFilter, setReconciledFilter] = useState<'' | 'true' | 'false'>('')

  const query = useBankStatementList({
    page: pageIndex,
    pageSize: PAGE_SIZE,
    reconciled: reconciledFilter === '' ? undefined : reconciledFilter === 'true',
  })
  const reconcileMutation = useReconcileBankStatementLine()

  const columns = useMemo<ColumnDef<BankStatementLine>[]>(
    () => [
      {
        id: 'statement_date',
        header: 'التاريخ / Date',
        accessor: (r) => r.statement_date,
        cell: (r) => (
          <span dir="ltr" className="text-zinc-500">
            {formatDate(r.statement_date)}
          </span>
        ),
      },
      { id: 'description', header: 'البيان / Description', accessor: (r) => r.description },
      { id: 'reference', header: 'المرجع / Ref', accessor: (r) => r.reference ?? '—' },
      {
        id: 'debit',
        header: 'مدين / Debit',
        accessor: (r) => r.debit,
        align: 'end',
        cell: (r) => (
          <span dir="ltr">{r.debit > 0 ? formatCurrency(r.debit) : '—'}</span>
        ),
      },
      {
        id: 'credit',
        header: 'دائن / Credit',
        accessor: (r) => r.credit,
        align: 'end',
        cell: (r) => (
          <span dir="ltr">{r.credit > 0 ? formatCurrency(r.credit) : '—'}</span>
        ),
      },
      {
        id: 'reconciled',
        header: 'المطابقة / Reconciled',
        accessor: (r) => r.reconciled,
        align: 'center',
        cell: (r) => (
          <Badge tone={r.reconciled ? 'success' : 'warning'}>
            {r.reconciled ? 'مطابق' : 'غير مطابق'}
          </Badge>
        ),
      },
      {
        id: '__actions',
        header: '',
        accessor: () => null,
        align: 'end',
        width: '8rem',
        cell: (r) =>
          perms.isSenior ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={reconcileMutation.isPending}
              onClick={() =>
                reconcileMutation.mutate({ id: r.$id, reconciled: !r.reconciled })
              }
            >
              {r.reconciled ? 'إلغاء المطابقة' : 'مطابقة'}
            </Button>
          ) : null,
      },
    ],
    [perms.isSenior, reconcileMutation],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="كشف الحساب البنكي"
        titleEn="Bank statement"
        description="مستوردة من ملف CSV (استيراد البيانات، مسؤول النظام) — مطابقة يدوية هنا."
      />

      <Card className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">عرض / Show:</span>
        {(
          [
            { value: '', label: 'الكل' },
            { value: 'false', label: 'غير مطابق' },
            { value: 'true', label: 'مطابق' },
          ] as const
        ).map((opt) => (
          <Button
            key={opt.value}
            size="sm"
            variant={reconciledFilter === opt.value ? 'primary' : 'ghost'}
            onClick={() => {
              setReconciledFilter(opt.value)
              setPageIndex(0)
            }}
          >
            {opt.label}
          </Button>
        ))}
      </Card>

      {reconcileMutation.isError ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {reconcileMutation.error.message}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={query.data?.rows ?? []}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, total: query.data?.total ?? 0 }}
        onPaginationChange={(next: PaginationState) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد سطور مستوردة بعد"
      />
    </div>
  )
}
