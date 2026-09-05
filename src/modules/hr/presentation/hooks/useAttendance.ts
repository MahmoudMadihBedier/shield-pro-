/**
 * TanStack Query bindings for `attendance_records` — a plain (non-document)
 * read + upsert-by-day log, not the shared `useDocument*` hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import {
  listAttendance,
  upsertAttendance,
  type AttendanceListPage,
  type AttendanceListParams,
  type UpsertAttendanceInput,
} from '../../data/attendance-repo'
import type { AttendanceRecord } from '../../domain/schemas'
import { hrKeys } from '../query-keys'

export function useAttendance(params: AttendanceListParams = {}) {
  return useQuery<AttendanceListPage, AppError>({
    queryKey: hrKeys.attendance.list(params),
    queryFn: async () => {
      const result = await listAttendance(params)
      if (!result.ok) throw result.error
      return result.value
    },
  })
}

export function useUpsertAttendance() {
  const queryClient = useQueryClient()
  return useMutation<AttendanceRecord, AppError, UpsertAttendanceInput>({
    mutationFn: async (input) => {
      const result = await upsertAttendance(input)
      if (!result.ok) throw result.error
      return result.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: hrKeys.root })
    },
  })
}
