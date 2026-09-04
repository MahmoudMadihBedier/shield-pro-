import { useMemo, useState } from 'react'

import { useDebouncedValue } from '@/shared/data-table'
import type { PaginationState } from '@/shared/data-table'
import { PageHeader } from '@/shared/ui'

import { GlEntryTable } from '../components'
import { useGlEntries } from '../hooks'

const PAGE_SIZE = 50

const INPUT_CLASS =
  'rounded-lg border border-black/15 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-zinc-500 dark:border-white/15'

export function GeneralLedgerPage() {
  const [account, setAccount] = useState('')
  const [voucherNo, setVoucherNo] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [pageIndex, setPageIndex] = useState(0)

  const debouncedAccount = useDebouncedValue(account, 300)
  const debouncedVoucher = useDebouncedValue(voucherNo, 300)

  const params = useMemo(
    () => ({
      account: debouncedAccount.trim() || undefined,
      voucherNo: debouncedVoucher.trim() || undefined,
      from: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
      page: pageIndex,
      pageSize: PAGE_SIZE,
    }),
    [debouncedAccount, debouncedVoucher, from, to, pageIndex],
  )

  const query = useGlEntries(params)

  const toolbar = (
    <div className="flex flex-wrap gap-2">
      <input
        className={INPUT_CLASS}
        placeholder="الحساب / Account"
        value={account}
        onChange={(e) => {
          setAccount(e.target.value)
          setPageIndex(0)
        }}
      />
      <input
        className={INPUT_CLASS}
        placeholder="رقم السند / Voucher no"
        value={voucherNo}
        onChange={(e) => {
          setVoucherNo(e.target.value)
          setPageIndex(0)
        }}
      />
      <input
        type="date"
        dir="ltr"
        className={INPUT_CLASS}
        value={from}
        onChange={(e) => {
          setFrom(e.target.value)
          setPageIndex(0)
        }}
      />
      <input
        type="date"
        dir="ltr"
        className={INPUT_CLASS}
        value={to}
        onChange={(e) => {
          setTo(e.target.value)
          setPageIndex(0)
        }}
      />
    </div>
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="دفتر الأستاذ"
        titleEn="General ledger"
        description="كل القيود المزدوجة، قابلة للتصفية."
      />

      <GlEntryTable
        rows={query.data?.rows ?? []}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, total: query.data?.total ?? 0 }}
        onPaginationChange={(next: PaginationState) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        toolbar={toolbar}
      />
    </div>
  )
}
