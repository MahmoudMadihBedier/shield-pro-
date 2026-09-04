/**
 * One warehouse transfer: the document envelope + lines, the Draft→Submit /
 * Submitted→Cancel bar, and the quadruple-step flow bar. When the flow reaches
 * `received` the stock ledger is posted (idempotent by `voucher_no`) and the
 * resulting movement is shown.
 */
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import { formatDate, formatNumber } from '@/shared/formatters'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { postTransferToLedger, type LedgerPostResult } from '../../data/post-movement'
import { parseLines } from '../../domain/line-utils'
import {
  transferLineSchema,
  type TransferStatus,
  type WarehouseTransferRow,
  type WarehouseTransferWriteFields,
} from '../../domain/schemas'
import { SubmitCancelBar, TransferFlowBar } from '../components'
import {
  optionLabelMap,
  useInventoryPermissions,
  useProductOptions,
  useWarehouseOptions,
  useWarehouseTransfer,
  useWarehouseTransferActions,
} from '../hooks'
import { TRANSFER_STATUS_LABEL, TRANSFER_STATUS_TONE } from '../labels'

export function WarehouseTransferDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const perms = useInventoryPermissions()

  const query = useWarehouseTransfer(id)
  const { updateDraft, submit, cancel } = useWarehouseTransferActions()

  const warehouses = useWarehouseOptions()
  const products = useProductOptions()
  const warehouseLabel = useMemo(() => optionLabelMap(warehouses.data), [warehouses.data])
  const productLabel = useMemo(() => optionLabelMap(products.data), [products.data])

  const [ledger, setLedger] = useState<LedgerPostResult | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const postLedger = useMutation<LedgerPostResult, AppError, WarehouseTransferRow>({
    mutationFn: async (row) => {
      const result = await postTransferToLedger(row)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: (value) => setLedger(value),
  })

  const row = query.data

  const advance = async (to: TransferStatus) => {
    if (!row) return
    setActionError(null)
    const patch: Partial<WarehouseTransferWriteFields> = { status: to }
    const actorId = perms.principal?.userId
    if (actorId) {
      if (to === 'approved') patch.approved_by = actorId
      else if (to === 'executed') patch.sent_by = actorId
      else if (to === 'received') patch.confirmed_received_by = actorId
    }

    try {
      await updateDraft.mutateAsync({ id: row.$id, patch })
      if (to === 'received') {
        await postLedger.mutateAsync({ ...row, status: 'received' })
      }
    } catch (e) {
      const message = e && typeof e === 'object' && 'message' in e ? String((e as AppError).message) : 'تعذّر تنفيذ الإجراء.'
      setActionError(message)
    }
  }

  const busy = updateDraft.isPending || submit.isPending || cancel.isPending || postLedger.isPending

  return (
    <div className="space-y-4">
      <PageHeader
        title={`تحويل ${row?.reference_id ?? ''}`}
        titleEn="Warehouse transfer"
        actions={
          <Button variant="ghost" onClick={() => navigate('/inventory/transfers')}>
            رجوع
          </Button>
        }
      />

      {query.isLoading ? <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card> : null}
      {query.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
      ) : null}
      {!query.isLoading && !query.isError && !row ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">لم يُعثر على التحويل.</Card>
      ) : null}

      {row ? (
        <>
          <Card className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TRANSFER_STATUS_TONE[row.status]}>{TRANSFER_STATUS_LABEL[row.status]}</Badge>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              <span>من: {warehouseLabel.get(row.from_warehouse_id) ?? row.from_warehouse_id}</span>
              <span>إلى: {warehouseLabel.get(row.to_warehouse_id) ?? row.to_warehouse_id}</span>
              <span dir="ltr" className="text-zinc-500">
                {formatDate(row.posting_datetime)}
              </span>
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
                {parseTransferLines(row).map((line, index) => (
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

          <SubmitCancelBar
            docStatus={row.doc_status}
            pending={busy}
            canSubmit={perms.canApproveTransfer}
            canCancel={perms.canApproveTransfer}
            onSubmit={() => void submit.mutateAsync(row.$id).catch((e: AppError) => setActionError(e.message))}
            onCancel={(reason) =>
              void cancel
                .mutateAsync({ id: row.$id, reason })
                .catch((e: AppError) => setActionError(e.message))
            }
          />

          <TransferFlowBar
            status={row.status}
            principal={perms.principal}
            pending={busy}
            onAdvance={(to) => void advance(to)}
          />

          {actionError ? (
            <Card className="text-sm text-red-600 dark:text-red-400">{actionError}</Card>
          ) : null}

          {ledger ? (
            <Card className="space-y-1 text-sm">
              <div className="font-semibold">الحركة المخزنية</div>
              {ledger.alreadyPosted ? (
                <p className="text-zinc-500">سبق ترحيل هذا السند إلى الدفتر — لا تغيير.</p>
              ) : (
                <p className="text-zinc-500">
                  تم ترحيل {formatNumber(ledger.posted?.entries ?? 0)} قيد إلى دفتر المخزون تحت السند{' '}
                  <span dir="ltr">{ledger.voucherNo}</span>.
                </p>
              )}
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function parseTransferLines(row: WarehouseTransferRow) {
  try {
    return parseLines(row.lines, transferLineSchema)
  } catch {
    return []
  }
}
