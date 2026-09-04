/**
 * One return request: envelope + lines, the pending → approve/reject step
 * (`ReturnStatusBar`), then the Draft→Submit / Submitted→Cancel bar once
 * `status === 'approved'`. Once Submitted, a manager picks the target
 * warehouse and posts the IN movement to the stock ledger — idempotent by
 * `voucher_no` (`postReturnToLedger` absorbs a re-post as `alreadyPosted`).
 */
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { DocStatus } from '@/core/doc-status'
import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import { formatDate, formatNumber } from '@/shared/formatters'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { postReturnToLedger, type ReturnLedgerPostResult } from '../../data/post-return'
import { originKind, originWarehouseHint } from '../../domain/origin'
import { parseReturnLines, type ReturnLine, type ReturnRequestRow, type ReturnStatus } from '../../domain/schemas'
import { DocStatusPill, ReturnStatusBar, SubmitCancelBar } from '../components'
import {
  optionLabelMap,
  RETURNS_MANAGER_ROLES,
  useProductOptions,
  useReturnRequest,
  useReturnRequestActions,
  useReturnsPermissions,
  useWarehouseOptions,
} from '../hooks'

function parseLinesSafe(row: ReturnRequestRow): ReturnLine[] {
  try {
    return parseReturnLines(row.lines)
  } catch {
    return []
  }
}

export function ReturnRequestDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const perms = useReturnsPermissions()

  const query = useReturnRequest(id)
  const { updateDraft, submit, cancel } = useReturnRequestActions()
  const products = useProductOptions()
  const productLabel = useMemo(() => optionLabelMap(products.data), [products.data])

  const [actionError, setActionError] = useState<string | null>(null)
  const [ledger, setLedger] = useState<ReturnLedgerPostResult | null>(null)

  const row = query.data
  const busy = updateDraft.isPending || submit.isPending || cancel.isPending

  const setStatus = async (status: ReturnStatus) => {
    if (!row) return
    setActionError(null)
    try {
      await updateDraft.mutateAsync({
        id: row.$id,
        patch: {
          status,
          ...(status === 'approved' ? { approved_by: perms.principal?.userId ?? null } : {}),
        },
      })
    } catch (e) {
      setActionError((e as AppError)?.message ?? 'تعذّر تنفيذ الإجراء.')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={`مرتجع ${row?.reference_id ?? ''}`}
        titleEn="Return request"
        actions={
          <Button variant="ghost" onClick={() => navigate('/returns/requests')}>
            رجوع
          </Button>
        }
      />

      {query.isLoading ? <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card> : null}
      {query.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
      ) : null}
      {!query.isLoading && !query.isError && !row ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">لم يُعثر على الطلب.</Card>
      ) : null}

      {row ? (
        <>
          <Card className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <DocStatusPill status={row.doc_status} />
              <Badge tone="neutral">
                المستند الأصلي: <span dir="ltr">{row.origin_ref}</span> (
                {originKind(row.origin_ref)})
              </Badge>
            </div>
            <p className="text-zinc-500">{originWarehouseHint(originKind(row.origin_ref))}</p>
            <p className="text-zinc-600 dark:text-zinc-400">السبب: {row.reason}</p>
            <div dir="ltr" className="text-zinc-500">
              {formatDate(row.posting_datetime)}
            </div>
          </Card>

          <Card className="p-0">
            <table className="w-full text-start text-sm">
              <thead className="bg-black/[0.02] text-xs text-zinc-500 dark:bg-white/[0.03]">
                <tr>
                  <th className="p-3 text-start font-semibold">الصنف / Product</th>
                  <th className="p-3 text-end font-semibold">الكمية / Qty</th>
                  <th className="p-3 text-start font-semibold">تفاصيل السبب / Reason detail</th>
                </tr>
              </thead>
              <tbody>
                {parseLinesSafe(row).map((line, index) => (
                  <tr key={index} className="border-t border-black/5 dark:border-white/5">
                    <td className="p-3">{productLabel.get(line.product_id) ?? line.product_id}</td>
                    <td className="p-3 text-end" dir="ltr">
                      {formatNumber(line.qty)}
                    </td>
                    <td className="p-3">{line.reason_detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {row.doc_status === DocStatus.Draft ? (
            <ReturnStatusBar
              status={row.status}
              requestedBy={row.requested_by}
              principal={perms.principal}
              managerRoles={RETURNS_MANAGER_ROLES}
              pending={busy}
              onApprove={() => void setStatus('approved')}
              onReject={() => void setStatus('rejected')}
            />
          ) : null}

          <SubmitCancelBar
            docStatus={row.doc_status}
            pending={busy}
            canSubmit={perms.canSubmitOrCancel && row.status === 'approved'}
            canCancel={perms.canSubmitOrCancel}
            onSubmit={() => void submit.mutateAsync(row.$id).catch((e: AppError) => setActionError(e.message))}
            onCancel={(reason) =>
              void cancel
                .mutateAsync({ id: row.$id, reason })
                .catch((e: AppError) => setActionError(e.message))
            }
          />

          {row.doc_status === DocStatus.Submitted ? (
            <PostToLedgerPanel row={row} canPost={perms.canPost} ledger={ledger} setLedger={setLedger} />
          ) : null}

          {actionError ? (
            <Card className="text-sm text-red-600 dark:text-red-400">{actionError}</Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function PostToLedgerPanel({
  row,
  canPost,
  ledger,
  setLedger,
}: {
  row: ReturnRequestRow
  canPost: boolean
  ledger: ReturnLedgerPostResult | null
  setLedger: (value: ReturnLedgerPostResult) => void
}) {
  const warehouses = useWarehouseOptions()
  const [picked, setPicked] = useState('')

  const postLedger = useMutation<ReturnLedgerPostResult, AppError, string>({
    mutationFn: async (warehouseId) => {
      const result = await postReturnToLedger(row, warehouseId)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: (value) => setLedger(value),
  })

  if (ledger) {
    return (
      <Card className="space-y-1 text-sm">
        <div className="font-semibold">الحركة المخزنية</div>
        {ledger.alreadyPosted ? (
          <p className="text-zinc-500">سبق ترحيل هذا المرتجع — لا تغيير.</p>
        ) : (
          <p className="text-zinc-500">
            تم ترحيل {formatNumber(ledger.posted?.entries ?? 0)} قيد إلى دفتر المخزون تحت السند{' '}
            <span dir="ltr">{ledger.voucherNo}</span>.
          </p>
        )}
      </Card>
    )
  }

  return (
    <Card className="space-y-2">
      <h3 className="text-sm font-semibold">اعتماد وترحيل المرتجع إلى دفتر المخزون</h3>

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600 dark:text-zinc-400">المخزن المستلم / Target warehouse</span>
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          disabled={!canPost || warehouses.isLoading || postLedger.isPending}
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
        >
          <option value="" disabled>
            {warehouses.isLoading ? 'جارٍ التحميل…' : 'اختر مخزنًا…'}
          </option>
          {(warehouses.data ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <Button
        disabled={!canPost || !picked || postLedger.isPending}
        onClick={() => postLedger.mutate(picked)}
      >
        {postLedger.isPending ? 'جارٍ الترحيل…' : 'ترحيل إلى دفتر المخزون'}
      </Button>

      {postLedger.isError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {postLedger.error.message}
        </p>
      ) : null}
    </Card>
  )
}
