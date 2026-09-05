/**
 * Pure attendance-tally helpers. `domain` is pure TypeScript — no framework
 * imports (`claude.md` B.4).
 */
import { ATTENDANCE_STATUSES, type AttendanceStatus } from './schemas'

export { ATTENDANCE_STATUSES }

/** `present` and `half_day` count as the employee having worked that day. */
export function isWorkingDay(status: AttendanceStatus): boolean {
  return status === 'present' || status === 'half_day'
}

export interface AttendanceSummary {
  present: number
  absent: number
  leave: number
  halfDay: number
}

/** Tally a list of attendance rows (e.g. one employee's month) by status. */
export function monthlyAttendanceSummary(
  records: ReadonlyArray<{ status: AttendanceStatus }>,
): AttendanceSummary {
  const summary: AttendanceSummary = { present: 0, absent: 0, leave: 0, halfDay: 0 }
  for (const record of records) {
    switch (record.status) {
      case 'present':
        summary.present += 1
        break
      case 'absent':
        summary.absent += 1
        break
      case 'leave':
        summary.leave += 1
        break
      case 'half_day':
        summary.halfDay += 1
        break
    }
  }
  return summary
}
