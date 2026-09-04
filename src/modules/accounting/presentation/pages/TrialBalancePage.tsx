import { useMemo, useState } from 'react'

import { Card, PageHeader } from '@/shared/ui'

import { TrialBalanceTable } from '../components'
import { useTrialBalance } from '../hooks'

export function TrialBalancePage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const range = useMemo(
    () => ({
      from: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
    }),
    [from, to],
  )

  const query = useTrialBalance(range)

  return (
    <div className="space-y-4">
      <PageHeader
        title="ميزان المراجعة"
        titleEn="Trial balance"
        description="أرصدة الحسابات من دفتر الأستاذ (القيود الملغاة مستبعدة)."
      />

      <Card className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">من / From</span>
          <input
            type="date"
            dir="ltr"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">إلى / To</span>
          <input
            type="date"
            dir="ltr"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </label>
      </Card>

      <TrialBalanceTable
        data={query.data}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
      />
    </div>
  )
}
