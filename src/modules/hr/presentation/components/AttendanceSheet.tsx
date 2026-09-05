/**
 * The daily attendance worksheet: one row per employee in the chosen branch,
 * each with a status picker and optional check-in/check-out times. A single
 * "save all" action (owned by the parent page) upserts every row for the
 * chosen date — presentation only, mirrors `inventory`'s `CountSheet` shape.
 */
import { useCallback } from 'react'

import { ATTENDANCE_STATUSES } from '../../domain/attendance'
import type { AttendanceStatus } from '../../domain/schemas'

const CONTROL =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-white/15'

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'حاضر',
  absent: 'غائب',
  leave: 'إجازة',
  half_day: 'نصف يوم',
}

export interface AttendanceSheetRow {
  userId: string
  fullName: string
  status: AttendanceStatus
  checkIn: string
  checkOut: string
  notes: string
}

export interface AttendanceSheetProps {
  value: AttendanceSheetRow[]
  onChange: (next: AttendanceSheetRow[]) => void
  disabled?: boolean
}

export function AttendanceSheet({ value, onChange, disabled = false }: AttendanceSheetProps) {
  const update = useCallback(
    (index: number, patch: Partial<AttendanceSheetRow>) => {
      onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)))
    },
    [value, onChange],
  )

  if (value.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-black/15 px-3 py-4 text-center text-sm text-zinc-500 dark:border-white/15">
        لا يوجد موظفون نشِطون لهذا الفرع.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div
        className="grid gap-2 px-2 text-xs font-semibold text-zinc-500"
        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr' }}
      >
        <span>الموظف / Employee</span>
        <span className="text-start">الحالة / Status</span>
        <span className="text-start">الحضور / In</span>
        <span className="text-start">الانصراف / Out</span>
        <span className="text-start">ملاحظات / Notes</span>
      </div>

      {value.map((row, index) => (
        <div
          key={row.userId}
          className="grid items-center gap-2 rounded-lg border border-black/10 p-2 dark:border-white/10"
          style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr' }}
        >
          <span className="truncate text-sm">{row.fullName}</span>

          <select
            className={CONTROL}
            disabled={disabled}
            value={row.status}
            onChange={(e) => update(index, { status: e.target.value as AttendanceStatus })}
          >
            {ATTENDANCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>

          <input
            type="time"
            dir="ltr"
            className={`${CONTROL} text-start`}
            disabled={disabled}
            value={row.checkIn}
            onChange={(e) => update(index, { checkIn: e.target.value })}
          />

          <input
            type="time"
            dir="ltr"
            className={`${CONTROL} text-start`}
            disabled={disabled}
            value={row.checkOut}
            onChange={(e) => update(index, { checkOut: e.target.value })}
          />

          <input
            type="text"
            className={CONTROL}
            disabled={disabled}
            value={row.notes}
            onChange={(e) => update(index, { notes: e.target.value })}
            placeholder="اختياري…"
          />
        </div>
      ))}
    </div>
  )
}
