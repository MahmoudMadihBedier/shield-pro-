import { DocStatus } from '@/core/doc-status'

const TABS: Array<{ value: DocStatus | undefined; label: string }> = [
  { value: undefined, label: 'الكل' },
  { value: DocStatus.Draft, label: 'مسودة' },
  { value: DocStatus.Submitted, label: 'معتمد' },
  { value: DocStatus.Cancelled, label: 'ملغي' },
]

/** Status-filter tabs for the `payroll_runs` list. */
export function DocStatusTabs({
  value,
  onChange,
}: {
  value: DocStatus | undefined
  onChange: (next: DocStatus | undefined) => void
}) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist">
      {TABS.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'border border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
