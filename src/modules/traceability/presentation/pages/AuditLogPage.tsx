import { useMemo, useState } from 'react'

import { DataTable, type ColumnDef } from '@/shared/data-table'
import { formatDateTime } from '@/shared/formatters'

import { entityLabel } from '../../domain/entity-labels'
import type { AuditRow } from '../../data/traceability-repo'
import { useAuditTrail } from '../hooks/useAuditTrail'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

function prettyJson(value?: string | null): string {
  if (!value) return '—'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function AuditDetail({ row }: { row: AuditRow }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer select-none rounded-md border border-black/10 px-2 py-0.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
        التغييرات
      </summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 font-medium text-zinc-500">قبل</p>
          <pre className="overflow-x-auto rounded-lg bg-black/5 p-2 dark:bg-white/5" dir="ltr">
            {prettyJson(row.before)}
          </pre>
        </div>
        <div>
          <p className="mb-1 font-medium text-zinc-500">بعد</p>
          <pre className="overflow-x-auto rounded-lg bg-black/5 p-2 dark:bg-white/5" dir="ltr">
            {prettyJson(row.after)}
          </pre>
        </div>
      </div>
    </details>
  )
}

export function AuditLogPage() {
  const [entityRefInput, setEntityRefInput] = useState('')
  const [actorIdInput, setActorIdInput] = useState('')

  const entityRef = useDebouncedValue(entityRefInput.trim())
  const actorId = useDebouncedValue(actorIdInput.trim())

  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAuditTrail({
      entityRef: entityRef || undefined,
      actorId: actorId || undefined,
    })

  const rows = useMemo(() => data?.pages.flatMap((page) => page.rows) ?? [], [data])

  const columns = useMemo<ColumnDef<AuditRow>[]>(
    () => [
      {
        id: 'created_at',
        header: 'الوقت / Time',
        accessor: (row) => row.created_at,
        cell: (row) => formatDateTime(row.created_at),
        width: 'minmax(11rem, 1fr)',
      },
      {
        id: 'actor_id',
        header: 'المستخدم / User',
        accessor: (row) => row.actor_id,
        cell: (row) => <span className="font-mono text-xs">{row.actor_id}</span>,
      },
      { id: 'action', header: 'الإجراء / Action', accessor: (row) => row.action },
      {
        id: 'entity_type',
        header: 'نوع المستند / Type',
        accessor: (row) => row.entity_type,
        cell: (row) => {
          const label = entityLabel(row.entity_type)
          return <span title={label.en}>{label.ar}</span>
        },
      },
      {
        id: 'entity_ref',
        header: 'رقم المرجع / Ref',
        accessor: (row) => row.entity_ref,
        cell: (row) => <span className="font-mono text-xs">{row.entity_ref}</span>,
      },
      {
        id: 'detail',
        header: 'تفاصيل / Detail',
        accessor: () => null,
        cell: (row) => <AuditDetail row={row} />,
        width: 'minmax(16rem, 1.5fr)',
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">سجل التدقيق</h2>
        <p className="mt-1 text-sm text-zinc-500">
          كل عملية تغيّر حالة مستند تُسجَّل هنا. صفِّ النتائج حسب رقم المرجع أو المستخدم.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="filter-entity" className="mb-1 block text-sm font-medium">
            رقم المرجع
          </label>
          <input
            id="filter-entity"
            type="search"
            dir="ltr"
            value={entityRefInput}
            onChange={(e) => setEntityRefInput(e.target.value)}
            placeholder="INV-2026-00042"
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-start font-mono text-sm outline-none focus:border-zinc-900 dark:border-white/15 dark:bg-zinc-900 dark:focus:border-white"
          />
        </div>
        <div>
          <label htmlFor="filter-actor" className="mb-1 block text-sm font-medium">
            معرّف المستخدم
          </label>
          <input
            id="filter-actor"
            type="search"
            dir="ltr"
            value={actorIdInput}
            onChange={(e) => setActorIdInput(e.target.value)}
            placeholder="user-id"
            className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-start font-mono text-sm outline-none focus:border-zinc-900 dark:border-white/15 dark:bg-zinc-900 dark:focus:border-white"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.$id}
        isLoading={isLoading}
        error={isError ? (error ?? null) : null}
        onRetry={() => void refetch()}
        emptyMessage="لا توجد سجلات مطابقة."
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={!hasNextPage || isFetchingNextPage}
          className="inline-flex items-center rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {isFetchingNextPage
            ? 'جارٍ التحميل…'
            : hasNextPage
              ? 'تحميل المزيد'
              : 'لا مزيد من السجلات'}
        </button>
        {rows.length > 0 ? (
          <span className="text-xs text-zinc-500">{rows.length} سجل معروض</span>
        ) : null}
      </div>
    </div>
  )
}
