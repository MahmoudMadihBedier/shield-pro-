/**
 * Generic master-data list screen: shared `DataTable` with server-side
 * sort / pagination / debounced search wired to the entity repo, plus a
 * create/edit dialog. All write controls are gated to the System Admin
 * (`claude.md` A.6 — UI hides what a role cannot do; real enforcement is
 * server-side).
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { useAuth } from '@/application/auth/context'
import { isSystemAdmin } from '@/core/rbac'
import { formatCurrency, formatNumber } from '@/shared/formatters'
import {
  DataTable,
  useDebouncedValue,
  type ColumnDef,
  type PaginationState,
  type SortState,
} from '@/shared/data-table'
import { Badge, Button, PageHeader, StatusPill } from '@/shared/ui'

import {
  CUSTOMER_APPROVAL_STATE_LABELS,
  ENTITY_LABELS,
  FIELD_LABELS,
  WAREHOUSE_KIND_LABELS,
  bilingual,
} from '../../domain/labels'
import type { CustomerApprovalState, WarehouseKind } from '../../domain/schemas'
import { useMasterList } from '../hooks/useMasterList'
import { useMasterMutations } from '../hooks/useMasterMutations'
import {
  ADMIN_REGISTRY,
  type AdminListEntity,
  type AdminRowMap,
  type CellFormat,
  type ColumnDescriptor,
} from '../registry'
import { EntityDialog } from './EntityDialog'
import { MasterFormPanel } from './MasterFormPanel'

const DEFAULT_PAGE_SIZE = 25

function renderCell(format: CellFormat | undefined, value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return '—'
  switch (format) {
    case 'currency':
      return formatCurrency(Number(value))
    case 'number':
      return formatNumber(Number(value))
    case 'bool':
      return value ? (
        <Badge tone="success">نعم</Badge>
      ) : (
        <Badge tone="neutral">لا</Badge>
      )
    case 'warehouseKind': {
      const label = WAREHOUSE_KIND_LABELS[value as WarehouseKind]
      return label ? label.ar : String(value)
    }
    case 'approvalState': {
      const state = value as CustomerApprovalState
      const label = CUSTOMER_APPROVAL_STATE_LABELS[state]
      return (
        <StatusPill tone={state === 'approved' ? 'success' : 'warning'}>
          {label ? label.ar : String(value)}
        </StatusPill>
      )
    }
    default:
      return String(value)
  }
}

export interface MasterListPageProps<K extends AdminListEntity> {
  entity: K
  /** Extra per-row controls rendered before edit/delete (System Admin only). */
  extraRowActions?: (row: AdminRowMap[K]) => ReactNode
}

export function MasterListPage<K extends AdminListEntity>({
  entity,
  extraRowActions,
}: MasterListPageProps<K>) {
  const config = ADMIN_REGISTRY[entity]
  const titles = ENTITY_LABELS[entity]
  const { principal } = useAuth()
  const canWrite = principal != null && isSystemAdmin(principal)

  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim())
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<SortState>({
    columnId: config.defaultSort.field,
    dir: config.defaultSort.dir,
  })
  const [dialog, setDialog] = useState<{ mode: 'create' | 'edit'; row?: AdminRowMap[K] } | null>(
    null,
  )

  const listSort = sort ? { field: sort.columnId, dir: sort.dir } : null
  const query = useMasterList(entity, { search, pageIndex, pageSize, sort: listSort })
  const mutations = useMasterMutations(entity)

  const handleSort = useCallback((next: SortState) => {
    setSort(next)
    setPageIndex(0)
  }, [])

  const handlePagination = useCallback((next: PaginationState) => {
    setPageIndex(next.pageIndex)
    setPageSize(next.pageSize)
  }, [])

  const handleRemove = useCallback(
    (row: AdminRowMap[K]) => {
      if (!mutations.remove) return
      const id = (row as { $id: string }).$id
      if (!window.confirm(`تأكيد حذف هذا السجل؟ (${id})`)) return
      void mutations.remove(id)
    },
    [mutations],
  )

  const columns = useMemo<ColumnDef<AdminRowMap[K]>[]>(() => {
    const dataColumns = config.columns.map((descriptor: ColumnDescriptor): ColumnDef<AdminRowMap[K]> => {
      const label = FIELD_LABELS[entity][descriptor.field] ?? {
        ar: descriptor.field,
        en: descriptor.field,
      }
      return {
        id: descriptor.field,
        header: bilingual(label),
        accessor: (row) => (row as Record<string, unknown>)[descriptor.field],
        cell: (row) =>
          renderCell(descriptor.format, (row as Record<string, unknown>)[descriptor.field]),
        sortable: descriptor.sortable,
        align: descriptor.align,
      }
    })

    if (!canWrite) return dataColumns

    const actionColumn: ColumnDef<AdminRowMap[K]> = {
      id: '__actions',
      header: bilingual({ ar: 'إجراءات', en: 'Actions' }),
      accessor: () => null,
      align: 'end',
      width: extraRowActions ? '18rem' : '12rem',
      cell: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          {extraRowActions?.(row)}
          <Button size="sm" variant="secondary" onClick={() => setDialog({ mode: 'edit', row })}>
            تعديل
          </Button>
          {mutations.remove ? (
            <Button size="sm" variant="danger" onClick={() => handleRemove(row)}>
              حذف
            </Button>
          ) : null}
        </div>
      ),
    }
    return [...dataColumns, actionColumn]
  }, [config.columns, entity, canWrite, mutations.remove, handleRemove, extraRowActions])

  const rows = query.data?.rows ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title={titles.many.ar}
        titleEn={titles.many.en}
        actions={
          canWrite ? (
            <Button onClick={() => setDialog({ mode: 'create' })}>
              + {titles.one.ar} جديد
            </Button>
          ) : (
            <Badge tone="info">عرض فقط</Badge>
          )
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => (row as { $id: string }).$id}
        pagination={{ pageIndex, pageSize, total }}
        onPaginationChange={handlePagination}
        sort={sort}
        onSortChange={handleSort}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد سجلات"
        toolbar={
          config.searchPlaceholder ? (
            <input
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                setPageIndex(0)
              }}
              placeholder={config.searchPlaceholder}
              className="w-full max-w-xs rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
            />
          ) : null
        }
      />

      <EntityDialog
        open={dialog != null}
        title={
          dialog?.mode === 'edit' ? `تعديل ${titles.one.ar}` : `${titles.one.ar} جديد`
        }
        titleEn={dialog?.mode === 'edit' ? `Edit ${titles.one.en}` : `New ${titles.one.en}`}
        onClose={() => setDialog(null)}
      >
        {dialog ? (
          <MasterFormPanel
            entity={entity}
            mode={dialog.mode}
            row={dialog.row}
            onDone={() => setDialog(null)}
          />
        ) : null}
      </EntityDialog>
    </div>
  )
}
