/**
 * Controlled repeater for multi-rep attribution: rows of (sales rep, branch).
 * Value/onChange like the module line editors — not RHF-context-bound — so
 * both the sales-invoice and purchase-order forms can drop it in.
 */
import type { RepAssignment } from '@/core/reps'

import type { SelectOption } from './fields'

export interface RepBranchEditorProps {
  value: readonly RepAssignment[]
  onChange: (next: RepAssignment[]) => void
  repOptions: readonly SelectOption[]
  branchOptions: readonly SelectOption[]
  disabled?: boolean
}

const SELECT =
  'w-full rounded-lg border border-black/15 bg-transparent px-2.5 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15'

export function RepBranchEditor({
  value,
  onChange,
  repOptions,
  branchOptions,
  disabled = false,
}: RepBranchEditorProps) {
  const rows = value

  const setRow = (i: number, patch: Partial<RepAssignment>) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  const add = () => onChange([...rows, { user_id: '', branch_id: '' }])
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      {rows.length === 0 ? <p className="text-xs text-zinc-500">لا يوجد مندوبون إضافيون.</p> : null}
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <select
            className={SELECT}
            disabled={disabled}
            value={row.user_id}
            onChange={(e) => setRow(i, { user_id: e.target.value })}
          >
            <option value="">المندوب…</option>
            {repOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className={SELECT}
            disabled={disabled}
            value={row.branch_id}
            onChange={(e) => setRow(i, { branch_id: e.target.value })}
          >
            <option value="">الفرع…</option>
            {branchOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => remove(i)}
            disabled={disabled}
            className="rounded-lg border border-black/15 px-2 py-1.5 text-xs hover:bg-black/5 dark:border-white/15"
          >
            حذف
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15"
      >
        + إضافة مندوب
      </button>
    </div>
  )
}
