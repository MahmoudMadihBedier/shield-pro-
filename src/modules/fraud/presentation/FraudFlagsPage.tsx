/**
 * Admin-facing fraud-detection dashboard: a `DataTable` of `fraud_flags`
 * (Implementation Plan §4 / Phase 2 Story 2.3) with a "Run scan" action and
 * per-row Review/Dismiss controls. RTL/Arabic-first, dark-mode aware, with
 * explicit loading / empty / error states (the shared `DataTable` renders
 * those; this page owns the scan feedback + status-tab UI on top).
 */
import { useCallback, useMemo, useState } from 'react'

import { formatDateTime } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Badge, Button, PageHeader, type BadgeTone } from '@/shared/ui'

import type { FraudFlagRow, FraudFlagStatus } from '../domain/schemas'
import { FRAUD_KIND_LABELS, FRAUD_STATUS_LABELS, bilingual } from '../domain/labels'
import { useFraudActions } from './hooks/useFraudActions'
import { useFraudFlags } from './hooks/useFraudFlags'

const PAGE_SIZE = 25

const STATUS_TABS: readonly FraudFlagStatus[] = ['open', 'reviewed', 'dismissed']

const STATUS_TONE: Record<FraudFlagStatus, BadgeTone> = {
  open: 'warning',
  reviewed: 'success',
  dismissed: 'neutral',
}

export function FraudFlagsPage() {
  const [status, setStatus] = useState<FraudFlagStatus>('open')
  const [pageIndex, setPageIndex] = useState(0)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null)

  const query = useFraudFlags({ status, page: pageIndex, pageSize: PAGE_SIZE })
  const { runScan, isScanning, review, isReviewing } = useFraudActions()

  async function handleRunScan() {
    setScanMessage(null)
    setScanErrorMessage(null)
    try {
      const result = await runScan()
      setScanMessage(
        result.flagsCreated > 0
          ? `تم إنشاء ${result.flagsCreated} بلاغ جديد / ${result.flagsCreated} new flag(s) created`
          : 'لم يتم العثور على أنماط جديدة / No new patterns found',
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : 'تعذّر تشغيل الفحص'
      setScanErrorMessage(message)
    }
  }

  const handleReview = useCallback(
    async (flagId: string, next: 'reviewed' | 'dismissed') => {
      try {
        await review({ flagId, status: next })
      } catch {
        // The mutation error is surfaced by react-query state; nothing to do
        // beyond letting the row stay as-is so the user can retry.
      }
    },
    [review],
  )

  const columns = useMemo<ColumnDef<FraudFlagRow>[]>(
    () => [
      {
        id: 'kind',
        header: 'النوع / Kind',
        accessor: (r) => r.kind,
        cell: (r) => bilingual(FRAUD_KIND_LABELS[r.kind]),
      },
      {
        id: 'subject',
        header: 'الموضوع / Subject',
        accessor: (r) => r.subject_id,
        cell: (r) => (
          <span dir="ltr" className="font-mono text-xs">
            {r.subject_type}: {r.subject_id}
          </span>
        ),
      },
      {
        id: 'detail',
        header: 'التفاصيل / Detail',
        accessor: (r) => r.detail,
        cell: (r) => <span className="text-zinc-600 dark:text-zinc-400">{r.detail ?? '—'}</span>,
      },
      {
        id: 'age',
        header: 'التاريخ / Age',
        accessor: (r) => r.created_at,
        align: 'end',
        cell: (r) => (
          <span dir="ltr" className="text-zinc-500">
            {formatDateTime(r.created_at)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'الحالة / Status',
        accessor: (r) => r.status,
        cell: (r) => (
          <Badge tone={STATUS_TONE[r.status]}>{bilingual(FRAUD_STATUS_LABELS[r.status])}</Badge>
        ),
      },
      {
        id: '__actions',
        header: '',
        accessor: () => null,
        align: 'end',
        width: '12rem',
        cell: (r) =>
          r.status === 'open' ? (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isReviewing}
                onClick={() => void handleReview(r.$id, 'reviewed')}
              >
                مراجعة / Review
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isReviewing}
                onClick={() => void handleReview(r.$id, 'dismissed')}
              >
                رفض / Dismiss
              </Button>
            </div>
          ) : null,
      },
    ],
    [isReviewing, handleReview],
  )

  const rows = query.data?.rows ?? []
  const total = query.data?.total ?? 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="كشف الاحتيال"
        titleEn="Fraud detection"
        description="بلاغات ناتجة عن فحص دوري لحركات المخزون وسجل التدقيق."
        actions={
          <Button disabled={isScanning} onClick={() => void handleRunScan()}>
            {isScanning ? 'جارٍ الفحص…' : 'تشغيل الفحص / Run scan'}
          </Button>
        }
      />

      {scanMessage ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          {scanMessage}
        </div>
      ) : null}
      {scanErrorMessage ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {scanErrorMessage}
        </div>
      ) : null}

      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab}
            size="sm"
            variant={status === tab ? 'primary' : 'secondary'}
            onClick={() => {
              setStatus(tab)
              setPageIndex(0)
            }}
          >
            {bilingual(FRAUD_STATUS_LABELS[tab])}
          </Button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, total }}
        onPaginationChange={(next: PaginationState) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد بلاغات في هذه الحالة"
      />
    </div>
  )
}
