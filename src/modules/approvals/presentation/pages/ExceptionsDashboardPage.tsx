/**
 * The exceptions dashboard: only `pending` approval requests — the movements
 * the engine force-routed to a human, never the auto-approved routine ones
 * (Implementation Plan §4.5, "shows exceptions, not routine approvals").
 *
 * A requester cannot decide their own request. The server is authoritative
 * (segregation of duties, `functions/routes/decide-approval.ts`); this page
 * also hides the buttons so no one is tempted to try (`claude.md` A.6).
 */
import { useCallback, useMemo, useState } from 'react'

import { useAuth } from '@/application/auth/context'
import type { AppError } from '@/core/errors'
import { DataTable, type ColumnDef } from '@/shared/data-table'
import { Badge, Button, PageHeader } from '@/shared/ui'

import { bilingual, movementTypeLabel } from '../../domain/labels'
import type { ApprovalRequestRow } from '../../domain/schemas'
import { useDecideApprovalRequest, usePendingApprovalRequests } from '../hooks/useApprovalExceptions'

const DEFAULT_PAGE_SIZE = 25
const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

function ageLabel(createdAt: string): string {
  const elapsed = Date.now() - new Date(createdAt).getTime()
  if (!Number.isFinite(elapsed) || elapsed < 0) return '—'
  if (elapsed < HOUR_MS) return 'أقل من ساعة / <1h'
  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS)
    return `${hours} س / ${hours}h`
  }
  const days = Math.floor(elapsed / DAY_MS)
  return `${days} يوم / ${days}d`
}

function DecisionCell({
  row,
  canDecide,
  reason,
  onReasonChange,
  onDecide,
  busy,
}: {
  row: ApprovalRequestRow
  canDecide: boolean
  reason: string
  onReasonChange: (value: string) => void
  onDecide: (decision: 'approved' | 'rejected') => void
  busy: boolean
}) {
  if (!canDecide) {
    return <span className="text-xs text-zinc-400">لا يمكنك اتخاذ قرار بشأن طلبك</span>
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <input
        type="text"
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        placeholder="السبب (اختياري)"
        aria-label={`سبب القرار — ${row.entity_ref}`}
        className="w-40 rounded-lg border border-black/15 bg-transparent px-2 py-1 text-xs outline-none focus:border-zinc-500 dark:border-white/15"
      />
      <Button size="sm" disabled={busy} onClick={() => onDecide('approved')}>
        قبول
      </Button>
      <Button size="sm" variant="danger" disabled={busy} onClick={() => onDecide('rejected')}>
        رفض
      </Button>
    </div>
  )
}

export function ExceptionsDashboardPage() {
  const { principal } = useAuth()
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({})
  const [rowError, setRowError] = useState<AppError | null>(null)

  const query = usePendingApprovalRequests({ pageIndex, pageSize })
  const decide = useDecideApprovalRequest()

  const rows = query.data?.rows ?? []
  const total = query.data?.total ?? 0

  const handleDecide = useCallback(
    (row: ApprovalRequestRow, decision: 'approved' | 'rejected') => {
      setRowError(null)
      const reason = reasonDraft[row.$id]?.trim()
      decide.mutate(
        { approvalRequestId: row.$id, decision, reason: reason || undefined },
        { onError: (error) => setRowError(error) },
      )
    },
    [reasonDraft, decide],
  )

  const columns = useMemo<ColumnDef<ApprovalRequestRow>[]>(
    () => [
      {
        id: 'entity_type',
        header: 'النوع / Type',
        accessor: (row) => row.entity_type,
        cell: (row) => bilingual(movementTypeLabel(row.entity_type)),
      },
      {
        id: 'entity_ref',
        header: 'المرجع / Ref',
        accessor: (row) => row.entity_ref,
        cell: (row) => <span className="font-mono text-xs">{row.entity_ref}</span>,
      },
      {
        id: 'requested_by',
        header: 'مقدّم الطلب / Requested by',
        accessor: (row) => row.requested_by,
        cell: (row) => <span className="font-mono text-xs">{row.requested_by}</span>,
      },
      {
        id: 'created_at',
        header: 'العمر / Age',
        accessor: (row) => row.created_at,
        cell: (row) => ageLabel(row.created_at),
      },
      {
        id: '__decision',
        header: 'القرار / Decision',
        align: 'end',
        width: 'minmax(20rem, 1fr)',
        accessor: () => null,
        cell: (row) => (
          <DecisionCell
            row={row}
            canDecide={principal != null && row.requested_by !== principal.userId}
            reason={reasonDraft[row.$id] ?? ''}
            onReasonChange={(value) => setReasonDraft((prev) => ({ ...prev, [row.$id]: value }))}
            onDecide={(decision) => handleDecide(row, decision)}
            busy={decide.isPending}
          />
        ),
      },
    ],
    [reasonDraft, decide.isPending, principal, handleDecide],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="لوحة الاستثناءات"
        titleEn="Exceptions dashboard"
        description="الحركات التي تجاوزت الموافقة التلقائية فقط — الموافقات الروتينية لا تُعرض هنا."
        actions={<Badge tone="warning">{total} بانتظار المراجعة</Badge>}
      />

      {rowError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {rowError.message}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize, total }}
        onPaginationChange={(next) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد استثناءات بانتظار المراجعة"
      />
    </div>
  )
}
