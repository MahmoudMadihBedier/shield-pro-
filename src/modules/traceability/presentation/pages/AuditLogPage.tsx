import { Fragment, useMemo, useState, type ReactNode } from 'react'

import { formatDateTime } from '@/shared/formatters'

import { entityLabel } from '../../domain/entity-labels'
import type { AuditRow } from '../../data/traceability-repo'
import { useAuditTrail } from '../hooks/useAuditTrail'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

// TODO: swap to shared DataTable (src/shared/data-table) once it lands.

function Notice({ tone, children }: { tone: 'info' | 'error'; children: ReactNode }) {
  const styles = {
    info: 'border-black/10 bg-white text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300',
    error:
      'border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  }[tone]
  return <div className={`rounded-xl border p-4 text-sm ${styles}`}>{children}</div>
}

function prettyJson(value?: string | null): string {
  if (!value) return '—'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function AuditDetailCell({ row }: { row: AuditRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-medium text-zinc-500">قبل</p>
        <pre
          className="overflow-x-auto rounded-lg bg-black/5 p-2 text-xs dark:bg-white/5"
          dir="ltr"
        >
          {prettyJson(row.before)}
        </pre>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-zinc-500">بعد</p>
        <pre
          className="overflow-x-auto rounded-lg bg-black/5 p-2 text-xs dark:bg-white/5"
          dir="ltr"
        >
          {prettyJson(row.after)}
        </pre>
      </div>
    </div>
  )
}

export function AuditLogPage() {
  const [entityRefInput, setEntityRefInput] = useState('')
  const [actorIdInput, setActorIdInput] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const entityRef = useDebouncedValue(entityRefInput.trim())
  const actorId = useDebouncedValue(actorIdInput.trim())

  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAuditTrail({
      entityRef: entityRef || undefined,
      actorId: actorId || undefined,
    })

  const rows = useMemo(() => data?.pages.flatMap((page) => page.rows) ?? [], [data])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

      {isLoading ? <Notice tone="info">جارٍ تحميل سجل التدقيق…</Notice> : null}

      {isError ? (
        <Notice tone="error">
          تعذر تحميل سجل التدقيق. {error?.message ?? 'حدث خطأ غير متوقع.'}
        </Notice>
      ) : null}

      {!isLoading && !isError && rows.length === 0 ? (
        <Notice tone="info">لا توجد سجلات مطابقة.</Notice>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
            <table className="w-full border-collapse text-start text-sm">
              <thead className="bg-black/5 text-xs text-zinc-500 dark:bg-white/5">
                <tr>
                  <th className="p-2 text-start font-medium">الوقت</th>
                  <th className="p-2 text-start font-medium">المستخدم</th>
                  <th className="p-2 text-start font-medium">الإجراء</th>
                  <th className="p-2 text-start font-medium">نوع المستند</th>
                  <th className="p-2 text-start font-medium">رقم المرجع</th>
                  <th className="p-2 text-start font-medium">
                    <span className="sr-only">تفاصيل</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isOpen = expanded.has(row.$id)
                  const label = entityLabel(row.entity_type)
                  return (
                    <Fragment key={row.$id}>
                      <tr className="border-t border-black/10 dark:border-white/10">
                        <td className="p-2 align-top whitespace-nowrap text-zinc-500">
                          {formatDateTime(row.created_at)}
                        </td>
                        <td className="p-2 align-top font-mono text-xs">{row.actor_id}</td>
                        <td className="p-2 align-top">{row.action}</td>
                        <td className="p-2 align-top">
                          <span title={label.en}>{label.ar}</span>
                        </td>
                        <td className="p-2 align-top font-mono text-xs">{row.entity_ref}</td>
                        <td className="p-2 align-top">
                          <button
                            type="button"
                            onClick={() => toggle(row.$id)}
                            aria-expanded={isOpen}
                            className="rounded-md border border-black/10 px-2 py-0.5 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                          >
                            {isOpen ? 'إخفاء' : 'التغييرات'}
                          </button>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-t border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
                          <td colSpan={6} className="p-3">
                            <AuditDetailCell row={row} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

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
            <span className="text-xs text-zinc-500">{rows.length} سجل معروض</span>
          </div>
        </>
      ) : null}
    </div>
  )
}
