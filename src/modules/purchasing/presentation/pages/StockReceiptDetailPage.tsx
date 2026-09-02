/**
 * Read-only stock-receipt view + lifecycle bar. Once the receipt is Submitted,
 * a panel posts it into the stock ledger (`postReceiptToLedger`) against a
 * chosen raw-store warehouse and shows the resulting bin balances.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { DocStatus } from '@/core/doc-status'
import type { AppError } from '@/core/errors'
import { formatCurrency, formatDateTime, formatNumber } from '@/shared/formatters'
import { Button, Card, PageHeader } from '@/shared/ui'

import { postReceiptToLedger, type ReceiptLedgerPosting } from '../../data/post-receipt'
import { parseReceiptLines } from '../../domain/lines'
import { RECEIPT_FIELD_LABELS, PURCHASING_LABELS } from '../../domain/labels'
import { canActOnPurchasing } from '../../domain/permissions'
import type { StockReceipt } from '../../domain/schemas'
import { DocStatusPill } from '../components/DocStatusPill'
import { SubmitCancelBar } from '../components/SubmitCancelBar'
import { useStockReceipt, useStockReceiptActions } from '../hooks/useStockReceipts'
import { useRawMaterialOptions, useRawStoreWarehouseOptions } from '../hooks/usePickerOptions'

export function StockReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { principal } = useAuth()
  const canAct = canActOnPurchasing(principal)

  const query = useStockReceipt(id)
  const actions = useStockReceiptActions()
  const rawMaterials = useRawMaterialOptions()

  const rawMaterialNameById = useMemo(
    () => new Map((rawMaterials.data ?? []).map((option) => [option.value, option.label])),
    [rawMaterials.data],
  )

  if (query.isLoading) {
    return <p className="text-sm text-zinc-500">جارٍ تحميل إذن الاستلام…</p>
  }
  if (query.isError) {
    return (
      <Card className="text-sm text-red-600 dark:text-red-400">
        {query.error.message}{' '}
        <button type="button" className="underline" onClick={() => void query.refetch()}>
          إعادة المحاولة
        </button>
      </Card>
    )
  }
  const receipt = query.data
  if (!receipt) {
    return <Card className="text-sm text-zinc-500">لا يوجد إذن استلام بهذا المعرّف.</Card>
  }

  const lines = parseReceiptLines(receipt.lines)

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${PURCHASING_LABELS.stockReceipt.one.ar} ${receipt.reference_id}`}
        titleEn={PURCHASING_LABELS.stockReceipt.one.en}
      />

      <Card className="space-y-2 text-sm">
        <Row label={RECEIPT_FIELD_LABELS.doc_status!.ar}>
          <DocStatusPill status={receipt.doc_status} />
        </Row>
        <Row label={RECEIPT_FIELD_LABELS.purchase_order_ref!.ar}>{receipt.purchase_order_ref}</Row>
        <Row label={RECEIPT_FIELD_LABELS.supplier_lot_number!.ar}>
          {receipt.supplier_lot_number ?? '—'}
        </Row>
        <Row label={RECEIPT_FIELD_LABELS.posting_datetime!.ar}>
          {formatDateTime(receipt.posting_datetime)}
        </Row>
        {receipt.remarks ? <Row label="ملاحظات">{receipt.remarks}</Row> : null}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">بنود الاستلام</h3>
        {lines.length === 0 ? (
          <p className="text-sm text-zinc-500">لا توجد بنود.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="p-2 text-start">{RECEIPT_FIELD_LABELS.raw_material_id!.ar}</th>
                  <th className="p-2 text-end">{RECEIPT_FIELD_LABELS.qty!.ar}</th>
                  <th className="p-2 text-end">{RECEIPT_FIELD_LABELS.unit_price!.ar}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr
                    key={`${line.raw_material_id}-${index}`}
                    className="border-t border-black/5 dark:border-white/5"
                  >
                    <td className="p-2">
                      {rawMaterialNameById.get(line.raw_material_id) ?? line.raw_material_id}
                    </td>
                    <td className="p-2 text-end" dir="ltr">
                      {formatNumber(line.qty)}
                    </td>
                    <td className="p-2 text-end" dir="ltr">
                      {formatCurrency(line.unit_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <SubmitCancelBar
          docStatus={receipt.doc_status}
          canAct={canAct}
          isPending={actions.isPending}
          onSubmit={() => actions.submit(receipt.$id)}
          onCancel={(reason) => actions.cancel(receipt.$id, reason)}
        />
        {receipt.doc_status === DocStatus.Submitted ? (
          <PostToLedgerPanel receipt={receipt} canAct={canAct} />
        ) : null}
        <p className="text-xs text-zinc-500">
          <Link to="/purchasing/receipts" className="underline">
            العودة إلى قائمة أذون الاستلام
          </Link>
        </p>
      </Card>
    </div>
  )
}

function PostToLedgerPanel({ receipt, canAct }: { receipt: StockReceipt; canAct: boolean }) {
  const warehouses = useRawStoreWarehouseOptions()
  const [picked, setPicked] = useState('')

  const options = warehouses.data ?? []
  // Auto-select when there is exactly one raw store; an explicit pick wins.
  const warehouseId = picked || (options.length === 1 && options[0] ? options[0].value : '')

  const mutation = useMutation<ReceiptLedgerPosting, AppError, string>({
    mutationFn: async (targetWarehouseId) => {
      const res = await postReceiptToLedger(receipt, targetWarehouseId)
      if (!res.ok) throw res.error
      return res.value
    },
  })

  return (
    <div className="space-y-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
      <h3 className="text-sm font-semibold">الترحيل إلى دفتر المخزون / Post to stock ledger</h3>

      {warehouses.isError ? (
        <p className="text-xs text-red-600 dark:text-red-400">تعذّر تحميل مخازن الخامات.</p>
      ) : (
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">
            مخزن الخامات / Raw store
          </span>
          <select
            value={warehouseId}
            onChange={(event) => setPicked(event.target.value)}
            disabled={!canAct || warehouses.isLoading || mutation.isPending}
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          >
            <option value="" disabled>
              {warehouses.isLoading ? 'جارٍ التحميل…' : 'اختر مخزن الخامات…'}
            </option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <Button
        onClick={() => mutation.mutate(warehouseId)}
        disabled={!canAct || !warehouseId || mutation.isPending}
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
            سبق ترحيل هذا الإذن إلى دفتر المخزون — لا حاجة لإجراء آخر.
          </p>
        ) : (
          <div className="space-y-1 text-xs">
            <p className="text-emerald-700 dark:text-emerald-400">
              تم الترحيل: {formatNumber(mutation.data.result?.entries ?? 0)} حركة مخزنية.
            </p>
            {(mutation.data.result?.balances ?? []).map((balance) => (
              <p
                key={`${balance.productId}-${balance.warehouseId}`}
                dir="ltr"
                className="text-zinc-500"
              >
                {balance.productId} @ {balance.warehouseId}: {formatNumber(balance.qtyAfter)}
              </p>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-40 shrink-0 text-zinc-500">{label}</span>
      <span>{children}</span>
    </div>
  )
}
