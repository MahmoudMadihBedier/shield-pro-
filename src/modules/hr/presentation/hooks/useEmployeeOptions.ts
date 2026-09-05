/**
 * Employee picker options for attendance / payroll screens — active staff
 * only, sourced from `data/employees-repo` (extends `@/modules/admin`'s `User`
 * shape with `base_salary`; see that file's header note).
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import { listEmployees, type Employee } from '../../data/employees-repo'
import { hrKeys } from '../query-keys'

export interface EmployeeOption {
  value: string
  label: string
  baseSalary: number
  branchId: string | null
}

export function useEmployeeOptions(branchId?: string) {
  return useQuery<EmployeeOption[], AppError>({
    queryKey: hrKeys.employees.options(branchId ?? null),
    staleTime: 60_000,
    queryFn: async () => {
      const result = await listEmployees({ activeOnly: true, branchId, pageSize: 200 })
      if (!result.ok) throw result.error
      return result.value.rows.map(toOption)
    },
  })
}

function toOption(employee: Employee): EmployeeOption {
  return {
    value: employee.$id,
    label: employee.full_name,
    baseSalary: employee.base_salary,
    branchId: employee.branch_id ?? null,
  }
}
