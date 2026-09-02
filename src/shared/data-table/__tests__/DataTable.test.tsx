import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { appError } from '@/core/errors'

import { DataTable } from '../DataTable'
import type { ColumnDef, PaginationState, SortState } from '../types'

interface Row {
  id: string
  name: string
  qty: number
}

const columns: ColumnDef<Row>[] = [
  { id: 'name', header: 'الاسم', accessor: (r) => r.name, sortable: true },
  { id: 'qty', header: 'الكمية', accessor: (r) => r.qty, align: 'end' },
]

const rows: Row[] = [
  { id: 'a', name: 'أحمد', qty: 3 },
  { id: 'b', name: 'سارة', qty: 7 },
]

const getRowId = (r: Row) => r.id

describe('DataTable states', () => {
  it('renders the loading skeleton', () => {
    render(<DataTable columns={columns} rows={[]} getRowId={getRowId} isLoading />)
    expect(screen.getByTestId('dt-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('dt-body')).not.toBeInTheDocument()
  })

  it('renders the error state with the message and a working Retry button', async () => {
    const onRetry = vi.fn()
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={getRowId}
        error={appError('server', 'تعذّر تحميل البيانات، حاول مرة أخرى')}
        onRetry={onRetry}
      />,
    )
    expect(screen.getByTestId('dt-error')).toHaveTextContent('تعذّر تحميل البيانات، حاول مرة أخرى')
    await userEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('renders the empty state with a custom message', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowId={getRowId}
        emptyMessage="لا يوجد عملاء بعد"
      />,
    )
    expect(screen.getByTestId('dt-empty')).toHaveTextContent('لا يوجد عملاء بعد')
  })

  it('renders the data state', () => {
    render(<DataTable columns={columns} rows={rows} getRowId={getRowId} />)
    expect(screen.getByTestId('dt-body')).toBeInTheDocument()
    expect(screen.getByText('أحمد')).toBeInTheDocument()
    expect(screen.getByText('سارة')).toBeInTheDocument()
  })
})

describe('DataTable sorting (controlled)', () => {
  it('cycles a sortable header asc → desc → null', async () => {
    const onSortChange = vi.fn()
    const { rerender } = render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={getRowId}
        sort={null}
        onSortChange={onSortChange}
      />,
    )
    const header = () => screen.getByRole('button', { name: /الاسم/ })

    await userEvent.click(header())
    expect(onSortChange).toHaveBeenLastCalledWith({ columnId: 'name', dir: 'asc' })

    const asc: SortState = { columnId: 'name', dir: 'asc' }
    rerender(
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={getRowId}
        sort={asc}
        onSortChange={onSortChange}
      />,
    )
    await userEvent.click(header())
    expect(onSortChange).toHaveBeenLastCalledWith({ columnId: 'name', dir: 'desc' })

    const desc: SortState = { columnId: 'name', dir: 'desc' }
    rerender(
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={getRowId}
        sort={desc}
        onSortChange={onSortChange}
      />,
    )
    await userEvent.click(header())
    expect(onSortChange).toHaveBeenLastCalledWith(null)
  })

  it('does not make a non-sortable header a button', () => {
    render(<DataTable columns={columns} rows={rows} getRowId={getRowId} onSortChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /الكمية/ })).not.toBeInTheDocument()
  })
})

describe('DataTable pagination (controlled)', () => {
  const pagination: PaginationState = { pageIndex: 0, pageSize: 25, total: 100 }

  it('fires onPaginationChange when Next is clicked and disables Prev on the first page', async () => {
    const onPaginationChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={getRowId}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
      />,
    )
    expect(screen.getByTestId('dt-prev')).toBeDisabled()
    await userEvent.click(screen.getByTestId('dt-next'))
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 25, total: 100 })
  })

  it('resets to the first page when the page size changes', async () => {
    const onPaginationChange = vi.fn()
    render(
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={getRowId}
        pagination={{ pageIndex: 2, pageSize: 25, total: 100 }}
        onPaginationChange={onPaginationChange}
      />,
    )
    await userEvent.selectOptions(screen.getByTestId('dt-page-size'), '50')
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 50, total: 100 })
  })
})

describe('DataTable virtualization', () => {
  it('renders a >100-row dataset without throwing', () => {
    const many: Row[] = Array.from({ length: 150 }, (_, i) => ({
      id: String(i),
      name: `عميل ${i}`,
      qty: i,
    }))
    expect(() =>
      render(<DataTable columns={columns} rows={many} getRowId={getRowId} />),
    ).not.toThrow()
    expect(screen.getByTestId('dt-body')).toBeInTheDocument()
  })
})
