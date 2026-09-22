/**
 * System Admin-only control: set (or clear) the date through which the books
 * are closed. `post_gl` / `post_stock_ledger` reject a posting dated at or
 * before it for every other role — the standard ERP period-close control.
 */
import { useState } from 'react'

import { formatDate } from '@/shared/formatters'
import { Button, Card } from '@/shared/ui'

import { usePostingLockDate, useSetPostingLockDate } from '../hooks'

export function PeriodLockPanel() {
  const query = usePostingLockDate()
  const mutation = useSetPostingLockDate()
  const [date, setDate] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleLock() {
    if (!date) return
    setError(null)
    try {
      await mutation.mutateAsync(date)
      setDate('')
    } catch (e) {
      setError((e as { message?: string }).message ?? 'تعذّر تحديث تاريخ الإغلاق.')
    }
  }

  async function handleClear() {
    setError(null)
    try {
      await mutation.mutateAsync(null)
    } catch (e) {
      setError((e as { message?: string }).message ?? 'تعذّر تحديث تاريخ الإغلاق.')
    }
  }

  return (
    <Card className="space-y-2">
      <div className="text-sm font-semibold">إغلاق الفترة المحاسبية / Period lock</div>
      <p className="text-xs text-zinc-500">
        لا يمكن ترحيل أي قيد بتاريخ يقع في هذا التاريخ أو قبله إلى دفتر الأستاذ أو دفتر المخزون —
        لأي دور غير مسؤول النظام.
      </p>
      <div className="text-sm">
        الحالة الحالية / Current lock:{' '}
        {query.isLoading ? (
          '…'
        ) : query.isError ? (
          <span className="text-red-600 dark:text-red-400">{query.error.message}</span>
        ) : query.data ? (
          <span dir="ltr" className="font-semibold">
            {formatDate(query.data)}
          </span>
        ) : (
          <span className="text-zinc-500">لا يوجد إغلاق / none</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          dir="ltr"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
        />
        <Button size="sm" disabled={!date || mutation.isPending} onClick={() => void handleLock()}>
          إغلاق حتى هذا التاريخ / Lock
        </Button>
        {query.data ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => void handleClear()}
          >
            إلغاء الإغلاق / Clear
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
    </Card>
  )
}
