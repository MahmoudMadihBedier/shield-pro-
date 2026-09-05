/**
 * Create a `payroll_runs` Draft: pick the pay period, pick a branch and either
 * select individual employees or add every active employee in that branch,
 * then edit each line in `PayrollLineEditor`. `lines` / `total_net_pay` are
 * derived (never typed by hand) and synced into the RHF field that
 * `payrollRunDraftSchema` validates before submit.
 */
import { useEffect, useMemo, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { appError } from '@/core/errors'
import { err, type Result } from '@/core/result'
import { DateField, Form, FormError } from '@/shared/forms'
import { formatCurrency } from '@/shared/formatters'
import { Button, Card, PageHeader } from '@/shared/ui'

import type { PayrollRunWriteFields } from '../../data/payroll-repo'
import { toIncentiveRuleLike, type IncentiveFacts } from '../../domain/incentives'
import { buildPayrollLinesFromFacts, payrollTotal, serializePayrollLines } from '../../domain/payroll'
import { payrollRunDraftSchema, type PayrollLine, type PayrollRunDraft } from '../../domain/schemas'
import { PayrollLineEditor, type PayrollLineEditorRow } from '../components'
import { useBranchOptions, useEmployeeOptions, useIncentiveRules, usePayrollRunActions } from '../hooks'

/** Writes the derived `lines` into the RHF field so `payrollRunDraftSchema` validates it. */
function LinesFieldSync({ lines }: { lines: PayrollLine[] }) {
  const { setValue, formState } = useFormContext<PayrollRunDraft>()
  // Re-sync only when the computed lines change.
  useEffect(() => {
    setValue('lines', lines, { shouldValidate: formState.isSubmitted })
  }, [lines, setValue, formState.isSubmitted])
  const error = formState.errors.lines?.message
  return typeof error === 'string' ? <p className="text-xs text-red-600">{error}</p> : null
}

interface RowOverride {
  facts: IncentiveFacts
  deductions: number
}

export function PayrollRunFormPage() {
  const navigate = useNavigate()
  const { createDraft } = usePayrollRunActions()

  const branches = useBranchOptions()
  const [branchId, setBranchId] = useState('')
  const employees = useEmployeeOptions(branchId || undefined)
  const incentiveRulesQuery = useIncentiveRules({
    page: 0,
    pageSize: 200,
    sort: { field: 'name', dir: 'asc' },
  })

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  /** Facts/deductions the preparer has typed in, keyed by employee — survives
   *  selection changes so re-checking an employee restores their entries. */
  const [overrides, setOverrides] = useState<ReadonlyMap<string, RowOverride>>(new Map())

  const employeeOptions = useMemo(() => employees.data ?? [], [employees.data])
  const incentiveRules = useMemo(() => incentiveRulesQuery.data?.rows ?? [], [incentiveRulesQuery.data])

  const editorRows = useMemo<PayrollLineEditorRow[]>(
    () =>
      employeeOptions
        .filter((employee) => selectedIds.has(employee.value))
        .map((employee) => {
          const override = overrides.get(employee.value)
          return {
            userId: employee.value,
            fullName: employee.label,
            baseSalary: employee.baseSalary,
            facts: override?.facts ?? {},
            deductions: override?.deductions ?? 0,
          }
        }),
    [employeeOptions, selectedIds, overrides],
  )

  const lines = useMemo(
    () => buildPayrollLinesFromFacts(editorRows, incentiveRules.map(toIncentiveRuleLike)),
    [editorRows, incentiveRules],
  )
  const total = useMemo(() => payrollTotal(lines), [lines])

  const defaultValues = useMemo<PayrollRunDraft>(
    () => ({ pay_period_start: '', pay_period_end: '', lines: [] }),
    [],
  )

  function selectAllInBranch() {
    setSelectedIds(new Set(employeeOptions.map((employee) => employee.value)))
  }

  function toggleEmployee(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleEditorChange(next: PayrollLineEditorRow[]) {
    setOverrides((prev) => {
      const nextMap = new Map(prev)
      for (const row of next) nextMap.set(row.userId, { facts: row.facts, deductions: row.deductions })
      return nextMap
    })
  }

  async function onSubmit(values: PayrollRunDraft): Promise<Result<unknown> | void> {
    if (values.lines.length === 0) {
      return err(appError('validation', 'أضف موظفًا واحدًا على الأقل.'))
    }
    try {
      const fields: PayrollRunWriteFields = {
        pay_period_start: values.pay_period_start,
        pay_period_end: values.pay_period_end,
        lines: serializePayrollLines(values.lines),
        total_net_pay: payrollTotal(values.lines),
      }
      const row = await createDraft.mutateAsync({ fields })
      navigate(`/hr/payroll/${row.$id}`)
    } catch (e) {
      return err(
        appError('server', 'تعذّر إنشاء مسير الرواتب. حاول مجددًا.', {
          detail: e instanceof Error ? e.message : String(e),
        }),
      )
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="مسير رواتب جديد"
        titleEn="New payroll run"
        actions={
          <Button variant="ghost" onClick={() => navigate('/hr/payroll')}>
            رجوع
          </Button>
        }
      />

      <Card>
        <Form schema={payrollRunDraftSchema} defaultValues={defaultValues} onSubmit={onSubmit}>
          {({ formError, isSubmitting }) => (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DateField name="pay_period_start" label="بداية الفترة" labelEn="Period start" required />
                <DateField name="pay_period_end" label="نهاية الفترة" labelEn="Period end" required />
              </div>

              <div>
                <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
                  الفرع / Branch
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={branchId}
                    onChange={(e) => {
                      setBranchId(e.target.value)
                      setSelectedIds(new Set())
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
                  <Button type="button" variant="secondary" size="sm" onClick={selectAllInBranch}>
                    تحديد كل الموظفين النشِطين
                  </Button>
                </div>
              </div>

              <div>
                <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">
                  اختر الموظفين / Employees
                </span>
                <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-black/10 p-2 dark:border-white/10">
                  {employeeOptions.length === 0 ? (
                    <span className="text-sm text-zinc-500">لا يوجد موظفون نشِطون.</span>
                  ) : (
                    employeeOptions.map((employee) => (
                      <label
                        key={employee.value}
                        className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2 py-1 text-sm dark:border-white/10"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(employee.value)}
                          onChange={() => toggleEmployee(employee.value)}
                        />
                        {employee.label}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <PayrollLineEditor
                value={editorRows}
                onChange={handleEditorChange}
                incentiveRules={incentiveRules}
                disabled={createDraft.isPending}
              />

              <LinesFieldSync lines={lines} />
              <FormError message={formError} />

              <div className="flex items-center justify-between border-t border-black/10 pt-3 dark:border-white/10">
                <span className="text-sm text-zinc-500">
                  الإجمالي / Total: <span dir="ltr">{formatCurrency(total)}</span>
                </span>
                <Button type="submit" disabled={isSubmitting || createDraft.isPending}>
                  حفظ كمسودة
                </Button>
              </div>
            </div>
          )}
        </Form>
      </Card>
    </div>
  )
}
