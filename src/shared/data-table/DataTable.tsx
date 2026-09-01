import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useMemo, useRef, type ReactNode } from 'react'

import type { AppError } from '@/core/errors'
import { formatNumber } from '@/shared/formatters'

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
      className={`ms-1 text-[0.65em] ${state === 'none' ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500'}`}
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
        className="grid items-center border-t border-black/5 text-sm dark:border-white/5"
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
          className="divide-y divide-black/5 dark:divide-white/5"
        >
          {Array.from({ length: 6 }).map((_, rowIdx) => (
            <div key={rowIdx} className="grid items-center" style={{ gridTemplateColumns }}>
              {columns.map((col) => (
                <div key={col.id} className="px-3 py-3">
                  <div className="h-3.5 w-2/3 animate-pulse rounded bg-black/10 dark:bg-white/10" />
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
          <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              إعادة المحاولة
            </button>
          ) : null}
        </div>
      )
    }

    if (rows.length === 0) {
      return (
        <div
          data-testid="dt-empty"
          role="status"
          className="px-4 py-12 text-center text-sm text-zinc-500"
        >
          {emptyMessage ?? 'لا توجد بيانات'}
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
    <div className="rounded-xl border border-black/10 bg-white text-zinc-900 shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100">
      {toolbar ? (
        <div className="border-b border-black/5 p-3 dark:border-white/5">{toolbar}</div>
      ) : null}

      <div className="overflow-x-auto">
        <div role="table" className="min-w-full">
          <div
            role="row"
            className="grid border-b border-black/10 bg-black/[0.02] text-xs font-semibold text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]"
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
                    className={`${cellCls} font-semibold uppercase tracking-wide hover:text-zinc-800 dark:hover:text-zinc-200`}
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 px-3 py-2.5 text-sm text-zinc-500 dark:border-white/10">
      <label className="flex items-center gap-2">
        <span>عدد الصفوف</span>
        <select
          data-testid="dt-page-size"
          value={pageSize}
          onChange={(event) =>
            onPaginationChange?.({ pageIndex: 0, pageSize: Number(event.target.value), total })
          }
          className="rounded-lg border border-black/15 bg-transparent px-2 py-1 dark:border-white/15"
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
            className="inline-flex items-center rounded-lg border border-black/15 p-1.5 disabled:opacity-40 enabled:hover:bg-black/5 dark:border-white/15 dark:enabled:hover:bg-white/10"
          >
            <ChevronToStart />
          </button>
          <button
            type="button"
            data-testid="dt-next"
            aria-label="الصفحة التالية"
            disabled={!canNext}
            onClick={() => onPaginationChange?.({ pageIndex: pageIndex + 1, pageSize, total })}
            className="inline-flex items-center rounded-lg border border-black/15 p-1.5 disabled:opacity-40 enabled:hover:bg-black/5 dark:border-white/15 dark:enabled:hover:bg-white/10"
          >
            <ChevronToEnd />
          </button>
        </div>
      </div>
    </div>
  )
}
