/**
 * `incentive_rules` list: shared `DataTable` + create/edit dialog. Writes are
 * System-Admin-gated in the UI (real enforcement is the collection
 * permissions in `scripts/appwrite/schema.ts` — `master(...)` tables are
 * System-Admin-write, everyone-read).
 */
import { useMemo, useState } from 'react'

import { useAuth } from '@/application/auth/context'
import { hasRole, Role } from '@/core/rbac'
import { formatCurrency, formatPercent } from '@/shared/formatters'
import { DataTable, useDebouncedValue, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Button, PageHeader, StatusPill } from '@/shared/ui'

import type { IncentiveKind, IncentiveRule } from '../../domain/schemas'
import { IncentiveRuleFormDialog } from '../components'
import { useIncentiveRuleMutations, useIncentiveRules } from '../hooks'

const KIND_LABEL: Record<IncentiveKind, string> = {
  sales_commission: 'عمولة مبيعات',
  production_bonus: 'مكافأة إنتاج',
  attendance_bonus: 'مكافأة حضور',
}

const DEFAULT_PAGE_SIZE = 25

function formatAmountOrPct(rule: IncentiveRule): string {
  return rule.kind === 'sales_commission' ? formatPercent(rule.amount_or_pct / 100) : formatCurrency(rule.amount_or_pct)
}

export function IncentiveRulesListPage() {
  const { principal } = useAuth()
  const canWrite = Boolean(principal && hasRole(principal, Role.SystemAdmin))

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim())
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [editing, setEditing] = useState<IncentiveRule | 'new' | null>(null)

  const query = useIncentiveRules({ search, page: pageIndex, pageSize, sort: { field: 'name', dir: 'asc' } })
  const mutations = useIncentiveRuleMutations()

  const columns = useMemo<ColumnDef<IncentiveRule>[]>(
    () => [
      { id: 'name', header: 'الاسم / Name', accessor: (row) => row.name, sortable: true },
      {
        id: 'kind',
        header: 'النوع / Kind',
        accessor: (row) => row.kind,
        cell: (row) => KIND_LABEL[row.kind],
      },
      {
        id: 'amount_or_pct',
        header: 'القيمة / Amount',
        accessor: (row) => row.amount_or_pct,
        align: 'end',
        cell: (row) => <span dir="ltr">{formatAmountOrPct(row)}</span>,
      },
      {
        id: 'is_active',
        header: 'الحالة / Status',
        accessor: (row) => row.is_active,
        align: 'center',
        cell: (row) => (
          <StatusPill tone={row.is_active ? 'success' : 'neutral'}>
            {row.is_active ? 'فعّالة' : 'موقوفة'}
          </StatusPill>
        ),
      },
      ...(canWrite
        ? [
            {
              id: 'actions',
              header: '',
              accessor: () => null,
              align: 'end' as const,
              cell: (row: IncentiveRule) => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                    تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={mutations.isPending}
                    onClick={() => void mutations.remove(row.$id)}
                  >
                    حذف
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canWrite, mutations],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="قواعد الحوافز"
        titleEn="Incentive rules"
        actions={canWrite ? <Button onClick={() => setEditing('new')}>+ قاعدة جديدة</Button> : null}
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
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد قواعد حوافز"
        toolbar={
          <input
            type="search"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setPageIndex(0)
            }}
            placeholder="ابحث بالاسم…"
            className="w-full max-w-xs rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          />
        }
      />

      <IncentiveRuleFormDialog
        open={editing !== null}
        row={editing !== 'new' ? (editing ?? undefined) : undefined}
        onClose={() => setEditing(null)}
      />
    </div>
  )
}
