import { describe, expect, it } from 'vitest'

import { isWorkingDay, monthlyAttendanceSummary } from '../attendance'

describe('isWorkingDay', () => {
  it('treats present as a working day', () => {
    expect(isWorkingDay('present')).toBe(true)
  })

  it('treats half_day as a working day', () => {
    expect(isWorkingDay('half_day')).toBe(true)
  })

  it('treats absent as not a working day', () => {
    expect(isWorkingDay('absent')).toBe(false)
  })

  it('treats leave as not a working day', () => {
    expect(isWorkingDay('leave')).toBe(false)
  })
})

describe('monthlyAttendanceSummary', () => {
  it('tallies each status independently', () => {
    const summary = monthlyAttendanceSummary([
      { status: 'present' },
      { status: 'present' },
      { status: 'absent' },
      { status: 'leave' },
      { status: 'half_day' },
    ])
    expect(summary).toEqual({ present: 2, absent: 1, leave: 1, halfDay: 1 })
  })

  it('returns all zeros for an empty list', () => {
    expect(monthlyAttendanceSummary([])).toEqual({ present: 0, absent: 0, leave: 0, halfDay: 0 })
  })
})
