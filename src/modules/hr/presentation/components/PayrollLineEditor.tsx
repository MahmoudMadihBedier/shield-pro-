/**
 * Per-employee payroll worksheet: base salary is auto-filled from
 * `User.base_salary` (read-only here — corrected via the `admin` module, not
 * payroll), incentives are computed live from the active `incentive_rules`
 * against a manually-entered set of period facts, deductions are manual, and
 * `net_pay` / the run total update live.
 *
 * v1 simplification (see `domain/incentives.ts` header): `salesAmount` /
 * `unitsProduced` / `attendanceDays` are typed in by the preparer rather than
 * pulled automatically from the sales/manufacturing/attendance modules — hr
 * may not import those modules, and wiring a proper cross-module facts feed is
 * a follow-up. Every active rule is evaluated against the same facts and
 * summed; assigning specific rules to specific employees is out of scope here.
 */
import { useCallback, useMemo } from 'react'

import { formatCurrency } from '@/shared/formatters'

import { toIncentiveRuleLike, type IncentiveFacts } from '../../domain/incentives'
import { buildPayrollLinesFromFacts, payrollTotal } from '../../domain/payroll'
import type { IncentiveRule } from '../../domain/schemas'

const CONTROL =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-white/15'

export interface PayrollLineEditorRow {
  userId: string
  fullName: string
  baseSalary: number
  facts: IncentiveFacts
  deductions: number
}

export interface PayrollLineEditorProps {
  value: PayrollLineEditorRow[]
  onChange: (next: PayrollLineEditorRow[]) => void
  /** Active incentive rules evaluated against every row's `facts`. */
  incentiveRules: readonly IncentiveRule[]
  disabled?: boolean
}

export function PayrollLineEditor({
  value,
  onChange,
  incentiveRules,
  disabled = false,
}: PayrollLineEditorProps) {
  const lines = useMemo(
    () => buildPayrollLinesFromFacts(value, incentiveRules.map(toIncentiveRuleLike)),
    [value, incentiveRules],
  )
  const total = useMemo(() => payrollTotal(lines), [lines])

  const update = useCallback(
    (index: number, patch: Partial<PayrollLineEditorRow> | { facts: Partial<IncentiveFacts> }) => {
      onChange(
        value.map((row, i) => {
          if (i !== index) return row
          if ('facts' in patch && patch.facts) {
            return { ...row, facts: { ...row.facts, ...patch.facts } }
          }
          return { ...row, ...(patch as Partial<PayrollLineEditorRow>) }
        }),
      )
    },
    [value, onChange],
  )

  if (value.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-black/15 px-3 py-4 text-center text-sm text-zinc-500 dark:border-white/15">
        اختر موظفين لإضافتهم إلى مسير الرواتب.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <div
        className="grid gap-2 px-2 text-xs font-semibold text-zinc-500"
        style={{ gridTemplateColumns: '1.6fr 1fr 0.8fr 0.8fr 0.8fr 1fr 1fr' }}
      >
        <span>الموظف / Employee</span>
        <span className="text-start">الراتب الأساسي</span>
        <span className="text-start">مبيعات</span>
        <span className="text-start">وحدات</span>
        <span className="text-start">أيام حضور</span>
        <span className="text-start">خصومات</span>
        <span className="text-start">صافي الراتب</span>
      </div>

      {value.map((row, index) => {
        const line = lines[index]
        return (
          <div
            key={row.userId}
            className="grid items-center gap-2 rounded-lg border border-black/10 p-2 dark:border-white/10"
            style={{ gridTemplateColumns: '1.6fr 1fr 0.8fr 0.8fr 0.8fr 1fr 1fr' }}
          >
            <span className="truncate text-sm">{row.fullName}</span>

            <span dir="ltr" className="text-start text-sm tabular-nums text-zinc-500">
              {formatCurrency(row.baseSalary)}
            </span>

            <input
              type="number"
              dir="ltr"
              inputMode="decimal"
              min={0}
              className={`${CONTROL} text-start`}
              disabled={disabled}
              value={row.facts.salesAmount ?? ''}
              onChange={(e) => update(index, { facts: { salesAmount: e.target.valueAsNumber } })}
            />

            <input
              type="number"
              dir="ltr"
              inputMode="decimal"
              min={0}
              className={`${CONTROL} text-start`}
              disabled={disabled}
              value={row.facts.unitsProduced ?? ''}
              onChange={(e) => update(index, { facts: { unitsProduced: e.target.valueAsNumber } })}
            />

            <input
              type="number"
              dir="ltr"
              inputMode="decimal"
              min={0}
              className={`${CONTROL} text-start`}
              disabled={disabled}
              value={row.facts.attendanceDays ?? ''}
              onChange={(e) => update(index, { facts: { attendanceDays: e.target.valueAsNumber } })}
            />

            <input
              type="number"
              dir="ltr"
              inputMode="decimal"
              min={0}
              className={`${CONTROL} text-start`}
              disabled={disabled}
              value={row.deductions}
              onChange={(e) => update(index, { deductions: e.target.valueAsNumber || 0 })}
            />

            <span dir="ltr" className="text-start text-sm font-semibold tabular-nums">
              {formatCurrency(line?.net_pay ?? 0)}
            </span>
          </div>
        )
      })}

      <div className="flex items-center justify-end gap-2 border-t border-black/10 pt-2 text-sm font-semibold dark:border-white/10">
        <span>الإجمالي / Total:</span>
        <span dir="ltr">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
