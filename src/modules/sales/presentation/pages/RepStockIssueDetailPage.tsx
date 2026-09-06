/**
 * One rep stock issue: envelope + lines, the approve / reject workflow (advances
 * `status` while the row is a Draft), the Draft→Submit / Submitted→Cancel bar,
 * and — once Submitted — a panel that posts the sub-warehouse → rep-custody
 * moves into the stock ledger (`postRepIssueToLedger`, idempotent by voucher).
 */
import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { DocStatus } from '@/core/doc-status'
import type { AppError } from '@/core/errors'
import { formatDateTime, formatNumber } from '@/shared/formatters'
import { AdminOverridePanel } from '@/shared/documents'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { postRepIssueToLedger, type RepIssueLedgerPosting } from '../../data/post-sales'
import { canActOnSales, canManageSales } from '../../domain/permissions'
import { parseRepIssueLines, type RepIssueLine, type RepStockIssueRow } from '../../domain/schemas'
import { DocStatusPill, SubmitCancelBar } from '../components'
import {
  optionLabelMap,
  useProductOptions,
  useRepCustodyWarehouseOptions,
  useRepOptions,
  useRepStockIssue,
  useRepStockIssueActions,
  useSubWarehouseOptions,
} from '../hooks'
import { REP_ISSUE_STATUS_LABEL, REP_ISSUE_STATUS_TONE } from '../labels'

export function RepStockIssueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { principal } = useAuth()
  const canAct = canActOnSales(principal)
  const canManage = canManageSales(principal)

  const query = useRepStockIssue(id)
  const actions = useRepStockIssueActions()

  const products = useProductOptions()
  const reps = useRepOptions()
  const subWarehouses = useSubWarehouseOptions()
  const productLabel = useMemo(() => optionLabelMap(products.data), [products.data])
  const repLabel = useMemo(() => optionLabelMap(reps.data), [reps.data])
  const whLabel = useMemo(() => optionLabelMap(subWarehouses.data), [subWarehouses.data])

  const [actionError, setActionError] = useState<string | null>(null)

  const isPending =
    actions.updateDraft.isPending || actions.submit.isPending || actions.cancel.isPending

  const issue = query.data

  const setStatus = async (status: RepStockIssueRow['status']) => {
    if (!issue) return
    setActionError(null)
    try {
      await actions.updateDraft.mutateAsync({
        id: issue.$id,
        patch: {
          status,
          ...(status === 'approved' ? { approved_by: principal?.userId ?? null } : {}),
        },
      })
    } catch (e) {
      setActionError((e as AppError)?.message ?? 'تعذّر تنفيذ الإجراء.')
    }
  }

  if (query.isLoading) return <p className="text-sm text-zinc-500">جارٍ تحميل الإذن…</p>
  if (query.isError) {
    return <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
  }
  if (!issue) return <Card className="text-sm text-zinc-500">لا يوجد إذن بهذا المعرّف.</Card>

  let lines: RepIssueLine[] = []
  try {
    lines = parseRepIssueLines(issue.lines)
  } catch {
    lines = []
  }

  const isDraft = issue.doc_status === DocStatus.Draft

  return (
    <div className="space-y-5">
      <PageHeader
        title={`إذن صرف ${issue.reference_id}`}
        titleEn="Rep stock issue"
        actions={
          <Button variant="ghost" onClick={() => navigate('/sales/rep-issues')}>
            رجوع
          </Button>
        }
      />

      <Card className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <DocStatusPill status={issue.doc_status} />
          <Badge tone={REP_ISSUE_STATUS_TONE[issue.status]}>
            {REP_ISSUE_STATUS_LABEL[issue.status]}
          </Badge>
        </div>
        <div>المخزن الفرعي: {whLabel.get(issue.sub_warehouse_id) ?? issue.sub_warehouse_id}</div>
        <div>المندوب: {repLabel.get(issue.rep_user_id) ?? issue.rep_user_id}</div>
        <div dir="ltr" className="text-zinc-500">
          {formatDateTime(issue.posting_datetime)}
        </div>
      </Card>

      <Card className="p-0">
        <table className="w-full text-start text-sm">
          <thead className="bg-black/[0.02] text-xs text-zinc-500 dark:bg-white/[0.03]">
            <tr>
              <th className="p-3 text-start font-semibold">الصنف / Product</th>
              <th className="p-3 text-end font-semibold">الكمية / Qty</th>
              <th className="p-3 text-start font-semibold">التشغيلة / Lot</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-t border-black/5 dark:border-white/5">
                <td className="p-3">{productLabel.get(line.product_id) ?? line.product_id}</td>
                <td className="p-3 text-end" dir="ltr">
                  {formatNumber(line.qty)}
                </td>
                <td className="p-3" dir="ltr">
                  {line.lot_number ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {isDraft && canManage && issue.status === 'pending' ? (
        <Card className="flex flex-wrap gap-2">
          <Button disabled={isPending} onClick={() => void setStatus('approved')}>
            اعتماد الطلب / Approve
          </Button>
          <Button variant="danger" disabled={isPending} onClick={() => void setStatus('rejected')}>
            رفض / Reject
          </Button>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <SubmitCancelBar
          docStatus={issue.doc_status}
          canAct={canAct && (issue.status === 'approved' || !isDraft)}
          isPending={isPending}
          onSubmit={() => actions.submit.mutateAsync(issue.$id)}
          onCancel={(reason) => actions.cancel.mutateAsync({ id: issue.$id, reason })}
        />
        {issue.doc_status === DocStatus.Submitted ? (
          <PostToLedgerPanel issue={issue} canAct={canAct} />
        ) : null}
        {actionError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
        ) : null}
      </Card>

      <AdminOverridePanel
        table="rep_stock_issues"
        row={issue}
        onDone={() => void query.refetch()}
      />
    </div>
  )
}

function PostToLedgerPanel({ issue, canAct }: { issue: RepStockIssueRow; canAct: boolean }) {
  const warehouses = useRepCustodyWarehouseOptions()
  const [picked, setPicked] = useState('')
  const options = warehouses.data ?? []
  const repCustodyWarehouseId =
    picked || (options.length === 1 && options[0] ? options[0].value : '')

  const mutation = useMutation<RepIssueLedgerPosting, AppError, string>({
    mutationFn: async (targetWarehouseId) => {
      const res = await postRepIssueToLedger(issue, {
        fromSubWarehouseId: issue.sub_warehouse_id,
        repCustodyWarehouseId: targetWarehouseId,
      })
      if (!res.ok) throw res.error
      return res.value
    },
  })

  return (
    <div className="space-y-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
      <h3 className="text-sm font-semibold">الترحيل إلى دفتر المخزون / Post to stock ledger</h3>

      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600 dark:text-zinc-400">
          مخزن عهدة المندوب / Rep custody warehouse
        </span>
        <select
          value={repCustodyWarehouseId}
          onChange={(e) => setPicked(e.target.value)}
          disabled={!canAct || warehouses.isLoading || mutation.isPending}
          className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
        >
          <option value="" disabled>
            {warehouses.isLoading ? 'جارٍ التحميل…' : 'اختر مخزن العهدة…'}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <Button
        onClick={() => mutation.mutate(repCustodyWarehouseId)}
        disabled={!canAct || !repCustodyWarehouseId || mutation.isPending}
      >
        {mutation.isPending ? 'جارٍ الترحيل…' : 'ترحيل إلى دفتر المخزون'}
      </Button>

      {mutation.isError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {mutation.error.message}
        </p>
      ) : null}

      {mutation.isSuccess ? (
        mutation.data.alreadyPosted ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            سبق ترحيل هذا الإذن — لا حاجة لإجراء آخر.
          </p>
        ) : (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            تم الترحيل: {formatNumber(mutation.data.posted?.entries ?? 0)} حركة مخزنية تحت السند{' '}
            <span dir="ltr">{mutation.data.voucherNo}</span>.
          </p>
        )
      ) : null}
    </div>
  )
}
