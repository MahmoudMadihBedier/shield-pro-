/**
 * `approval_rules` management screen. Read for any staff member; create/edit
 * gated to the System Admin in-page (`claude.md` A.6 — the UI hides what a
 * role cannot do, the server is authoritative via `masterDataPerms`).
 */
import { useCallback, useMemo, useState } from 'react'

import { useAuth } from '@/application/auth/context'
import { isSystemAdmin } from '@/core/rbac'
import { formatNumber } from '@/shared/formatters'
import {
  DataTable,
  useDebouncedValue,
  type ColumnDef,
  type PaginationState,
  type SortState,
} from '@/shared/data-table'
import { Badge, Button, PageHeader } from '@/shared/ui'

import { APPROVAL_ACTION_LABELS, bilingual, movementTypeLabel } from '../../domain/labels'
import type { ApprovalRuleRow } from '../../domain/schemas'
import { useApprovalRulesList } from '../hooks/useApprovalRules'
import { RuleFormDialog } from '../components/RuleFormDialog'

const DEFAULT_PAGE_SIZE = 25

export function ApprovalRulesListPage() {
  const { principal } = useAuth()
  const canWrite = principal != null && isSystemAdmin(principal)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim())
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<SortState>({ columnId: 'movement_type', dir: 'asc' })
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; row?: ApprovalRuleRow } | null>(
    null,
  )

  const listSort = sort ? { field: sort.columnId, dir: sort.dir } : null
  const query = useApprovalRulesList({ search, pageIndex, pageSize, sort: listSort })

  const handleSort = useCallback((next: SortState) => {
    setSort(next)
    setPageIndex(0)
  }, [])

  const handlePagination = useCallback((next: PaginationState) => {
    setPageIndex(next.pageIndex)
    setPageSize(next.pageSize)
  }, [])

  const columns = useMemo<ColumnDef<ApprovalRuleRow>[]>(() => {
    const base: ColumnDef<ApprovalRuleRow>[] = [
      {
        id: 'movement_type',
        header: 'نوع الحركة / Movement',
        sortable: true,
        accessor: (row) => row.movement_type,
        cell: (row) => bilingual(movementTypeLabel(row.movement_type)),
      },
      {
        id: 'action',
        header: 'الإجراء / Action',
        accessor: (row) => row.action,
        cell: (row) => bilingual(APPROVAL_ACTION_LABELS[row.action]),
      },
      {
        id: 'priority',
        header: 'الأولوية / Priority',
        align: 'end',
        sortable: true,
        accessor: (row) => row.priority,
        cell: (row) => formatNumber(row.priority),
      },
      {
        id: 'is_active',
        header: 'مفعّلة؟ / Active',
        align: 'center',
        accessor: (row) => row.is_active,
        cell: (row) =>
          row.is_active ? <Badge tone="success">نعم</Badge> : <Badge tone="neutral">لا</Badge>,
      },
    ]

    if (!canWrite) return base

    const actionColumn: ColumnDef<ApprovalRuleRow> = {
      id: '__actions',
      header: 'إجراءات / Actions',
      align: 'end',
      accessor: () => null,
      cell: (row) => (
        <Button size="sm" variant="secondary" onClick={() => setDialog({ mode: 'edit', row })}>
          تعديل
        </Button>
      ),
    }
    return [...base, actionColumn]
  }, [canWrite])

  const rows = query.data?.rows ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="قواعد الموافقة"
        titleEn="Approval rules"
        description="القواعد التي يستخدمها محرك الموافقة التلقائية لكل نوع حركة."
        actions={
          canWrite ? (
            <Button onClick={() => setDialog({ mode: 'create' })}>+ قاعدة جديدة</Button>
          ) : (
            <Badge tone="info">عرض فقط</Badge>
          )
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize, total }}
        onPaginationChange={handlePagination}
        sort={sort}
        onSortChange={handleSort}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد قواعد موافقة"
        toolbar={
          <input
            type="search"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value)
              setPageIndex(0)
            }}
            placeholder="ابحث بنوع الحركة…"
            className="w-full max-w-xs rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          />
        }
      />

      {canWrite ? (
        <RuleFormDialog
          open={dialog != null}
          mode={dialog?.mode ?? 'create'}
          row={dialog?.row}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}
