/**
 * Attendance list: branch + date-range filters, the shared `DataTable`, and a
 * monthly present/absent/leave/half-day summary for the filtered rows.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { formatDateTime } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Button, Card, PageHeader, StatusPill, type BadgeTone } from '@/shared/ui'

import { monthlyAttendanceSummary } from '../../domain/attendance'
import type { AttendanceRecord, AttendanceStatus } from '../../domain/schemas'
import { useAttendance, useBranchOptions, useEmployeeOptions } from '../hooks'

const STATUS_STYLE: Record<AttendanceStatus, { ar: string; tone: BadgeTone }> = {
  present: { ar: 'حاضر', tone: 'success' },
  absent: { ar: 'غائب', tone: 'danger' },
  leave: { ar: 'إجازة', tone: 'info' },
  half_day: { ar: 'نصف يوم', tone: 'warning' },
}

const DEFAULT_PAGE_SIZE = 31

function firstAndLastOfMonth(): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  return { from, to }
}

export function AttendanceListPage() {
  const navigate = useNavigate()
  const [branchId, setBranchId] = useState('')
  const [{ from, to }, setRange] = useState(firstAndLastOfMonth)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const branches = useBranchOptions()
  const employees = useEmployeeOptions(branchId || undefined)
  const query = useAttendance({
    branchId: branchId || undefined,
    from,
    to,
    page: pageIndex,
    pageSize,
  })

  const employeeNameById = useMemo(
    () => new Map((employees.data ?? []).map((option) => [option.value, option.label])),
    [employees.data],
  )

  const summary = useMemo(
    () => monthlyAttendanceSummary(query.data?.rows ?? []),
    [query.data?.rows],
  )

  const columns = useMemo<ColumnDef<AttendanceRecord>[]>(
    () => [
      {
        id: 'date',
        header: 'التاريخ / Date',
        accessor: (row) => row.date,
        cell: (row) => (
          <span dir="ltr" className="font-mono text-sm">
            {row.date}
          </span>
        ),
      },
      {
        id: 'user_id',
        header: 'الموظف / Employee',
        accessor: (row) => employeeNameById.get(row.user_id) ?? row.user_id,
      },
      {
        id: 'status',
        header: 'الحالة / Status',
        accessor: (row) => row.status,
        align: 'center',
        cell: (row) => (
          <StatusPill tone={STATUS_STYLE[row.status].tone}>{STATUS_STYLE[row.status].ar}</StatusPill>
        ),
      },
      {
        id: 'check_in',
        header: 'الحضور / In',
        accessor: (row) => row.check_in,
        cell: (row) => (row.check_in ? <span dir="ltr">{formatDateTime(row.check_in)}</span> : '—'),
      },
      {
        id: 'notes',
        header: 'ملاحظات / Notes',
        accessor: (row) => row.notes,
      },
    ],
    [employeeNameById],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="الحضور والانصراف"
        titleEn="Attendance"
        actions={
          <Button onClick={() => navigate('/hr/attendance/sheet')}>تسجيل حضور اليوم</Button>
        }
      />

      <Card className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">الفرع / Branch</span>
          <select
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value)
              setPageIndex(0)
            }}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          >
            <option value="">كل الفروع</option>
            {(branches.data ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">من / From</span>
          <input
            type="date"
            dir="ltr"
            value={from}
            onChange={(e) => {
              setRange((prev) => ({ ...prev, from: e.target.value }))
              setPageIndex(0)
            }}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">إلى / To</span>
          <input
            type="date"
            dir="ltr"
            value={to}
            onChange={(e) => {
              setRange((prev) => ({ ...prev, to: e.target.value }))
              setPageIndex(0)
            }}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          />
        </label>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="حاضر" labelEn="Present" value={summary.present} tone="success" />
        <SummaryTile label="غائب" labelEn="Absent" value={summary.absent} tone="danger" />
        <SummaryTile label="إجازة" labelEn="Leave" value={summary.leave} tone="info" />
        <SummaryTile label="نصف يوم" labelEn="Half day" value={summary.halfDay} tone="warning" />
      </div>

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
        emptyMessage="لا توجد سجلات حضور في هذه الفترة"
      />
    </div>
  )
}

function SummaryTile({
  label,
  labelEn,
  value,
  tone,
}: {
  label: string
  labelEn: string
  value: number
  tone: BadgeTone
}) {
  return (
    <Card className="space-y-1">
      <StatusPill tone={tone}>{label}</StatusPill>
      <div className="text-xs text-zinc-400">{labelEn}</div>
      <div dir="ltr" className="text-lg font-semibold">
        {value}
      </div>
    </Card>
  )
}
