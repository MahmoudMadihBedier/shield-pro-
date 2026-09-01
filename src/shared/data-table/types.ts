import type { ReactNode } from 'react'

/** Horizontal alignment for a column, expressed in logical (RTL-safe) terms. */
export type ColumnAlign = 'start' | 'end' | 'center'

/**
 * Column configuration for {@link DataTable}. Presentation only — an `accessor`
 * pulls a raw value out of a row (used for the sort affordance / default cell),
 * and an optional `cell` renders custom content. No sorting/filtering logic
 * lives here; the parent owns all state.
 */
export interface ColumnDef<Row> {
  id: string
  header: string
  accessor: (row: Row) => unknown
  cell?: (row: Row) => ReactNode
  sortable?: boolean
  align?: ColumnAlign
  /** Any valid CSS grid track size, e.g. `'12rem'`, `'1fr'`, `'minmax(8rem, 1fr)'`. */
  width?: string
}

/** Controlled sort state. `null` means "no sort applied". */
export type SortState = { columnId: string; dir: 'asc' | 'desc' } | null

/** Controlled pagination state. `total` is the full (server-side) row count. */
export interface PaginationState {
  pageIndex: number
  pageSize: number
  total: number
}
