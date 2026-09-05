/**
 * One payroll run: envelope + per-employee lines, and the Draft→Submit /
 * Submitted→Cancel bar — gated to `SUBMIT_ROLE_BY_TABLE['payroll_runs']`
 * (Chief Accountant / System Admin).
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { canSubmitTable } from '@/core/access'
import type { AppError } from '@/core/errors'
import { formatCurrency, formatDate } from '@/shared/formatters'
import { Button, Card, PageHeader } from '@/shared/ui'

import { parsePayrollLines } from '../../domain/payroll'
import type { PayrollRunRow } from '../../domain/schemas'
import { DocStatusPill, SubmitCancelBar } from '../components'
import { useEmployeeOptions, usePayrollRun, usePayrollRunActions } from '../hooks'

function parseLinesSafely(row: PayrollRunRow) {
  try {
    return parsePayrollLines(row.lines)
  } catch {
    return []
  }
}

export function PayrollRunDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { principal } = useAuth()
  const canAct = Boolean(principal && canSubmitTable(principal.roles, 'payroll_runs'))

  const query = usePayrollRun(id)
  const { submit, cancel } = usePayrollRunActions()
  const employees = useEmployeeOptions()
  const employeeNameById = useMemo(
    () => new Map((employees.data ?? []).map((option) => [option.value, option.label])),
    [employees.data],
  )

  const [actionError, setActionError] = useState<string | null>(null)
  const row = query.data
  const lines = useMemo(() => (row ? parseLinesSafely(row) : []), [row])
  const busy = submit.isPending || cancel.isPending

  return (
    <div className="space-y-4">
      <PageHeader
        title={`مسير رواتب ${row?.reference_id ?? ''}`}
        titleEn="Payroll run"
        actions={
          <Button variant="ghost" onClick={() => navigate('/hr/payroll')}>
            رجوع
          </Button>
        }
      />

      {query.isLoading ? <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card> : null}
      {query.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
      ) : null}
      {!query.isLoading && !query.isError && !row ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">لم يُعثر على السجل.</Card>
      ) : null}

      {row ? (
        <>
          <Card className="flex flex-wrap items-center gap-3 text-sm">
            <DocStatusPill status={row.doc_status} />
            <span dir="ltr" className="text-zinc-500">
              {formatDate(row.pay_period_start)} – {formatDate(row.pay_period_end)}
            </span>
            <span className="font-semibold">الإجمالي: {formatCurrency(row.total_net_pay)}</span>
          </Card>

          <Card className="p-0">
            <table className="w-full text-start text-sm">
              <thead className="bg-black/[0.02] text-xs text-zinc-500 dark:bg-white/[0.03]">
                <tr>
                  <th className="p-3 text-start font-semibold">الموظف / Employee</th>
                  <th className="p-3 text-end font-semibold">الراتب الأساسي</th>
                  <th className="p-3 text-end font-semibold">الحوافز</th>
                  <th className="p-3 text-end font-semibold">الخصومات</th>
                  <th className="p-3 text-end font-semibold">صافي الراتب</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.user_id} className="border-t border-black/5 dark:border-white/5">
                    <td className="p-3">{employeeNameById.get(line.user_id) ?? line.user_id}</td>
                    <td className="p-3 text-end" dir="ltr">
                      {formatCurrency(line.base_salary)}
                    </td>
                    <td className="p-3 text-end" dir="ltr">
                      {formatCurrency(line.incentives)}
                    </td>
                    <td className="p-3 text-end" dir="ltr">
                      {formatCurrency(line.deductions)}
                    </td>
                    <td className="p-3 text-end font-semibold" dir="ltr">
                      {formatCurrency(line.net_pay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <SubmitCancelBar
            docStatus={row.doc_status}
            canAct={canAct}
            isPending={busy}
            onSubmit={() =>
              void submit.mutateAsync(row.$id).catch((e: AppError) => setActionError(e.message))
            }
            onCancel={(reason) =>
              void cancel
                .mutateAsync({ id: row.$id, reason })
                .catch((e: AppError) => setActionError(e.message))
            }
          />

          {actionError ? (
            <Card className="text-sm text-red-600 dark:text-red-400">{actionError}</Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
