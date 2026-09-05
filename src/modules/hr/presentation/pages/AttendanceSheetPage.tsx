/**
 * Daily attendance entry: pick a branch + date, then edit every active
 * employee's status/check-in/check-out in one worksheet and save it in one
 * action. Existing rows for that day are pre-loaded (upsert-by-day, so
 * re-opening the same date edits rather than duplicates).
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { isAppError } from '@/core/errors'
import { Button, Card, PageHeader } from '@/shared/ui'

import { AttendanceSheet, type AttendanceSheetRow } from '../components'
import { useAttendance, useBranchOptions, useEmployeeOptions, useUpsertAttendance } from '../hooks'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function AttendanceSheetPage() {
  const navigate = useNavigate()
  const { principal } = useAuth()
  const branches = useBranchOptions()
  const [branchId, setBranchId] = useState('')
  const [date, setDate] = useState(todayIso)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const employees = useEmployeeOptions(branchId || undefined)
  const existing = useAttendance({ branchId: branchId || undefined, from: date, to: date, pageSize: 200 })
  const upsert = useUpsertAttendance()

  /** The seeded worksheet: every active employee, pre-filled from today's
   *  existing record if one was already saved. */
  const baseRows = useMemo<AttendanceSheetRow[]>(() => {
    const existingByUser = new Map((existing.data?.rows ?? []).map((row) => [row.user_id, row]))
    return (employees.data ?? []).map((employee) => {
      const found = existingByUser.get(employee.value)
      return {
        userId: employee.value,
        fullName: employee.label,
        status: found?.status ?? 'present',
        checkIn: toTimeInput(found?.check_in),
        checkOut: toTimeInput(found?.check_out),
        notes: found?.notes ?? '',
      }
    })
  }, [employees.data, existing.data])

  /** In-progress edits, keyed by employee — reset whenever the branch/date
   *  changes (a fresh worksheet) or the sheet is saved. */
  const [edits, setEdits] = useState<ReadonlyMap<string, AttendanceSheetRow>>(new Map())
  const rows = useMemo(
    () => baseRows.map((row) => edits.get(row.userId) ?? row),
    [baseRows, edits],
  )

  const canSave = Boolean(principal) && rows.length > 0

  function resetSheet() {
    setEdits(new Map())
    setSaved(false)
    setSaveError(null)
  }

  function handleRowsChange(next: AttendanceSheetRow[]) {
    setEdits(new Map(next.map((row) => [row.userId, row])))
    setSaved(false)
  }

  async function handleSaveAll() {
    if (!principal) return
    setSaveError(null)
    try {
      for (const row of rows) {
        await upsert.mutateAsync({
          userId: row.userId,
          date,
          checkIn: fromTimeInput(date, row.checkIn),
          checkOut: fromTimeInput(date, row.checkOut),
          status: row.status,
          notes: row.notes || undefined,
          branchId: branchId || null,
          createdBy: principal.userId,
        })
      }
      setSaved(true)
    } catch (e) {
      setSaveError(isAppError(e) ? e.message : 'تعذّر حفظ الحضور.')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="تسجيل الحضور"
        titleEn="Attendance sheet"
        actions={
          <Button variant="ghost" onClick={() => navigate('/hr/attendance')}>
            رجوع
          </Button>
        }
      />

      <Card className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">الفرع / Branch</span>
          <select
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value)
              resetSheet()
            }}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          >
            <option value="" disabled>
              اختر فرعًا…
            </option>
            {(branches.data ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">التاريخ / Date</span>
          <input
            type="date"
            dir="ltr"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              resetSheet()
            }}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          />
        </label>
      </Card>

      {!branchId ? (
        <Card className="text-sm text-zinc-500">اختر فرعًا لعرض موظفيه.</Card>
      ) : employees.isLoading || existing.isLoading ? (
        <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card>
      ) : employees.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{employees.error.message}</Card>
      ) : (
        <Card className="space-y-4">
          <AttendanceSheet value={rows} onChange={handleRowsChange} disabled={upsert.isPending} />
          <div className="flex items-center gap-3">
            <Button onClick={() => void handleSaveAll()} disabled={!canSave || upsert.isPending}>
              {upsert.isPending ? 'جارٍ الحفظ…' : 'حفظ الكل'}
            </Button>
            {saved ? <span className="text-sm text-emerald-600 dark:text-emerald-400">تم الحفظ.</span> : null}
          </div>
          {saveError ? <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p> : null}
        </Card>
      )}
    </div>
  )
}

function toTimeInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(11, 16)
}

function fromTimeInput(dateStr: string, time: string): string | undefined {
  if (!time) return undefined
  return new Date(`${dateStr}T${time}:00`).toISOString()
}
