import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useMemo, useRef, type ReactNode } from 'react'

import type { AppError } from '@/core/errors'
import { formatNumber } from '@/shared/formatters'
import { EmptyState, Skeleton } from '@/shared/ui'

import type { ColumnAlign, ColumnDef, PaginationState, SortState } from './types'

/** Above this row count the body is windowed with `@tanstack/react-virtual`. */
const VIRTUALIZE_THRESHOLD = 100
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const ESTIMATED_ROW_HEIGHT = 44
const VIRTUAL_VIEWPORT_HEIGHT = 480

export interface DataTableProps<Row> {
  columns: ReadonlyArray<ColumnDef<Row>>
  rows: ReadonlyArray<Row>
  getRowId: (row: Row) => string
  pagination?: PaginationState
  onPaginationChange?: (next: PaginationState) => void
  sort?: SortState
  onSortChange?: (next: SortState) => void
  isLoading?: boolean
  error?: AppError | null
  emptyMessage?: string
  onRetry?: () => void
  toolbar?: ReactNode
}

function alignClass(align: ColumnAlign | undefined): string {
  if (align === 'end') return 'text-end'
  if (align === 'center') return 'text-center'
  return 'text-start'
}

function defaultCell(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return '—'
}

/** Cycle a header through asc → desc → unsorted. */
function nextSort(current: SortState, columnId: string): SortState {
  if (!current || current.columnId !== columnId) return { columnId, dir: 'asc' }
  if (current.dir === 'asc') return { columnId, dir: 'desc' }
  return null
}

function SortGlyph({ state }: { state: 'asc' | 'desc' | 'none' }) {
  const symbol = state === 'asc' ? '▲' : state === 'desc' ? '▼' : '↕'
  return (
    <span
      aria-hidden="true"
      className={`ms-1 text-[0.65em] ${state === 'none' ? 'text-zinc-300 dark:text-zinc-600' : 'text-brand-600 dark:text-brand-400'}`}
    >
      {symbol}
    </span>
  )
}

function ChevronToStart() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 rtl:-scale-x-100"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronToEnd() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 rtl:-scale-x-100"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The single shared list/grid surface for every module (`claude.md` B.6).
 *
 * Presentation only — ZERO business logic. Sorting, paging and filtering state
 * are all **controlled** by the parent; the table never mutates `rows`. It
 * renders four visibly-distinct states (loading / error / empty / data) and
 * never surfaces a raw error string.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  pagination,
  onPaginationChange,
  sort = null,
  onSortChange,
  isLoading = false,
  error = null,
  emptyMessage,
  onRetry,
  toolbar,
}: DataTableProps<Row>) {
  const gridTemplateColumns = useMemo(
    () => columns.map((col) => col.width ?? 'minmax(8rem, 1fr)').join(' '),
    [columns],
  )

  const isVirtual = rows.length > VIRTUALIZE_THRESHOLD

  const renderRowContent = useCallback(
    (row: Row) => (
      <div
        role="row"
        className="grid items-center border-t border-[var(--border)] text-sm transition-colors hover:bg-[var(--surface-hover)]"
        style={{ gridTemplateColumns }}
      >
        {columns.map((col) => (
          <div key={col.id} role="cell" className={`truncate px-3 py-2.5 ${alignClass(col.align)}`}>
            {col.cell ? col.cell(row) : defaultCell(col.accessor(row))}
          </div>
        ))}
      </div>
    ),
    [columns, gridTemplateColumns],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  // Its output is consumed inline in this component only (never handed to a
  // memoized child), so the React-Compiler skip this rule warns about is fine.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
  })

  const handleHeaderClick = useCallback(
    (col: ColumnDef<Row>) => {
      if (!col.sortable || !onSortChange) return
      onSortChange(nextSort(sort, col.id))
    },
    [onSortChange, sort],
  )

  const body = (() => {
    if (isLoading) {
      return (
        <div
          data-testid="dt-loading"
          aria-busy="true"
          role="status"
          className="divide-y divide-[var(--border)]"
        >
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <div key={rowIdx} className="grid items-center" style={{ gridTemplateColumns }}>
              {columns.map((col) => (
                <div key={col.id} className="px-3 py-3.5">
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              ))}
            </div>
          ))}
          <span className="sr-only">جارٍ التحميل…</span>
        </div>
      )
    }

    if (error) {
      return (
        <div
          data-testid="dt-error"
          role="alert"
          className="flex flex-col items-center gap-3 px-4 py-12 text-center"
        >
          <span className="grid size-10 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <svg viewBox="0 0 20 20" className="size-5" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm1-11a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0V7Zm-1 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--surface-hover)]"
            >
              إعادة المحاولة
            </button>
          ) : null}
        </div>
      )
    }

    if (rows.length === 0) {
      return (
        <div data-testid="dt-empty" role="status">
          <EmptyState title={emptyMessage ?? 'لا توجد بيانات'} />
        </div>
      )
    }

    if (isVirtual) {
      return (
        <div
          data-testid="dt-body"
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: VIRTUAL_VIEWPORT_HEIGHT }}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]
              if (!row) return null
              return (
                <div
                  key={getRowId(row)}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    insetInlineStart: 0,
                    insetInlineEnd: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {renderRowContent(row)}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div data-testid="dt-body">
        {rows.map((row) => (
          <div key={getRowId(row)}>{renderRowContent(row)}</div>
        ))}
      </div>
    )
  })()

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm">
      {toolbar ? (
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] p-3">{toolbar}</div>
      ) : null}

      <div className="overflow-x-auto">
        <div role="table" className="min-w-full">
          <div
            role="row"
            className="sticky top-0 z-10 grid border-b border-[var(--border)] bg-[var(--surface-2)] text-xs font-semibold text-[var(--text-muted)] backdrop-blur"
            style={{ gridTemplateColumns }}
          >
            {columns.map((col) => {
              const state: 'asc' | 'desc' | 'none' =
                sort && sort.columnId === col.id ? sort.dir : 'none'
              const cellCls = `flex items-center px-3 py-2.5 ${
                col.align === 'end'
                  ? 'justify-end'
                  : col.align === 'center'
                    ? 'justify-center'
                    : 'justify-start'
              }`
              if (col.sortable && onSortChange) {
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleHeaderClick(col)}
                    aria-sort={
                      state === 'asc' ? 'ascending' : state === 'desc' ? 'descending' : 'none'
                    }
                    className={`${cellCls} font-semibold uppercase tracking-wide transition-colors hover:text-brand-600 dark:hover:text-brand-400 ${
                      state !== 'none' ? 'text-brand-600 dark:text-brand-400' : ''
                    }`}
                  >
                    <span className="truncate">{col.header}</span>
                    <SortGlyph state={state} />
                  </button>
                )
              }
              return (
                <div key={col.id} className={`${cellCls} uppercase tracking-wide`}>
                  <span className="truncate">{col.header}</span>
                </div>
              )
            })}
          </div>

          {body}
        </div>
      </div>

      {pagination ? (
        <PaginationFooter pagination={pagination} onPaginationChange={onPaginationChange} />
      ) : null}
    </div>
  )
}

function PaginationFooter({
  pagination,
  onPaginationChange,
}: {
  pagination: PaginationState
  onPaginationChange?: (next: PaginationState) => void
}) {
  const { pageIndex, pageSize, total } = pagination
  const start = total === 0 ? 0 : pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, total)
  const canPrev = pageIndex > 0
  const canNext = end < total

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
      <label className="flex items-center gap-2">
        <span>عدد الصفوف</span>
        <select
          data-testid="dt-page-size"
          value={pageSize}
          onChange={(event) =>
            onPaginationChange?.({ pageIndex: 0, pageSize: Number(event.target.value), total })
          }
          className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3">
        <span data-testid="dt-range">
          {formatNumber(start)}–{formatNumber(end)} من {formatNumber(total)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="dt-prev"
            aria-label="الصفحة السابقة"
            disabled={!canPrev}
            onClick={() => onPaginationChange?.({ pageIndex: pageIndex - 1, pageSize, total })}
            className="inline-flex items-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-1.5 transition-colors disabled:opacity-40 enabled:hover:border-brand-400 enabled:hover:text-brand-600 dark:enabled:hover:text-brand-400"
          >
            <ChevronToStart />
          </button>
          <button
            type="button"
            data-testid="dt-next"
            aria-label="الصفحة التالية"
            disabled={!canNext}
            onClick={() => onPaginationChange?.({ pageIndex: pageIndex + 1, pageSize, total })}
            className="inline-flex items-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-1.5 transition-colors disabled:opacity-40 enabled:hover:border-brand-400 enabled:hover:text-brand-600 dark:enabled:hover:text-brand-400"
          >
            <ChevronToEnd />
          </button>
        </div>
      </div>
    </div>
  )
}
