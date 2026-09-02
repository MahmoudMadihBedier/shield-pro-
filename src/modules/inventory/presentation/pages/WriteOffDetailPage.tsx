/**
 * One write-off: envelope + lines, the Draft→Submit / Submitted→Cancel bar, and
 * — once submitted — a manager action that posts the stock-out to the ledger
 * (idempotent by `voucher_no`).
 */
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { DocStatus } from '@/core/doc-status'
import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import { formatDate, formatNumber } from '@/shared/formatters'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { postWriteOffToLedger, type LedgerPostResult } from '../../data/post-movement'
import { parseLines } from '../../domain/line-utils'
import { writeOffLineSchema, type WriteOffRow } from '../../domain/schemas'
import { SubmitCancelBar } from '../components'
import {
  optionLabelMap,
  useInventoryPermissions,
  useProductOptions,
  useWarehouseOptions,
  useWriteOff,
  useWriteOffActions,
} from '../hooks'
import { WRITE_OFF_KIND_LABEL } from '../labels'

export function WriteOffDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const perms = useInventoryPermissions()

  const query = useWriteOff(id)
  const { submit, cancel } = useWriteOffActions()
  const warehouses = useWarehouseOptions()
  const products = useProductOptions()
  const warehouseLabel = useMemo(() => optionLabelMap(warehouses.data), [warehouses.data])
  const productLabel = useMemo(() => optionLabelMap(products.data), [products.data])

  const [actionError, setActionError] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerPostResult | null>(null)

  const postLedger = useMutation<LedgerPostResult, AppError, WriteOffRow>({
    mutationFn: async (writeOff) => {
      const result = await postWriteOffToLedger(writeOff)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: (value) => setLedger(value),
  })

  const row = query.data
  const busy = submit.isPending || cancel.isPending || postLedger.isPending

  return (
    <div className="space-y-4">
      <PageHeader
        title={`هالك ${row?.reference_id ?? ''}`}
        titleEn="Write-off"
        actions={
          <Button variant="ghost" onClick={() => navigate('/inventory/write-offs')}>
            رجوع
          </Button>
        }
      />

      {query.isLoading ? <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card> : null}
      {query.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
      ) : null}
      {!query.isLoading && !query.isError && !row ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">لم يُعثر على السجل.</Card>
      ) : null}

      {row ? (
        <>
          <Card className="space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{WRITE_OFF_KIND_LABEL[row.kind]}</Badge>
              <span className="text-zinc-500">
                {warehouseLabel.get(row.warehouse_id) ?? row.warehouse_id}
              </span>
              <span dir="ltr" className="text-zinc-500">
                {formatDate(row.posting_datetime)}
              </span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400">السبب: {row.reason}</p>
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
                {parseWriteOffLines(row).map((line, index) => (
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
            canSubmit={perms.canRequest}
            canCancel={perms.canApproveTransfer}
            onSubmit={() => void submit.mutateAsync(row.$id).catch((e: AppError) => setActionError(e.message))}
            onCancel={(reason) =>
              void cancel
                .mutateAsync({ id: row.$id, reason })
                .catch((e: AppError) => setActionError(e.message))
            }
          />

          {row.doc_status === DocStatus.Submitted && perms.canApproveTransfer && !ledger ? (
            <Button disabled={busy} onClick={() => void postLedger.mutateAsync(row)}>
              اعتماد وترحيل الهالك إلى الدفتر
            </Button>
          ) : null}

          {actionError ? (
            <Card className="text-sm text-red-600 dark:text-red-400">{actionError}</Card>
          ) : null}

          {ledger ? (
            <Card className="space-y-1 text-sm">
              <div className="font-semibold">الحركة المخزنية</div>
              {ledger.alreadyPosted ? (
                <p className="text-zinc-500">سبق ترحيل هذا السند — لا تغيير.</p>
              ) : (
                <p className="text-zinc-500">
                  تم ترحيل {formatNumber(ledger.posted?.entries ?? 0)} قيد تحت السند{' '}
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

function parseWriteOffLines(row: WriteOffRow) {
  try {
    return parseLines(row.lines, writeOffLineSchema)
  } catch {
    return []
  }
}
