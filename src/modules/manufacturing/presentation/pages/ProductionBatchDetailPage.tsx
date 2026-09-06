/**
 * One production batch: header facts, consumed raw lots, the QC bar (release /
 * reject while Draft — QC happens BEFORE submit), then the Submit / Cancel bar.
 *
 * After a successful Submit the finished units + consumed raw lots are posted to
 * the immutable stock ledger through `postBatchToLedger` (voucher_no = the
 * batch reference id). That call is idempotent server-side: a repeat comes back
 * as a `conflict` error, surfaced here as a neutral "already posted" notice via
 * `isAlreadyPosted`, never as a hard failure. A Submitted batch also gets a
 * manual "post stock" button so a posting that failed after submit can be
 * retried safely.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { DocStatus } from '@/core/doc-status'
import { formatCurrency, formatDate, formatQuantity } from '@/shared/formatters'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { isAlreadyPosted, postBatchToLedger } from '../../data/post-batch'
import { parseRawMaterialLots } from '../../domain/planning'
import type { ProductionBatch } from '../../domain/schemas'
import { AdminOverridePanel } from '@/shared/documents'

import { QcActionBar } from '../components/QcActionBar'
import { SubmitCancelBar } from '../components/SubmitCancelBar'
import { useFactoryWarehouses, useProductOptions } from '../hooks/catalog'
import { useProductionBatch, useProductionBatchActions } from '../hooks/documents'
import { QC_STATUS_LABEL, QC_STATUS_TONE } from '../labels'

type LedgerState =
  | { kind: 'idle' }
  | { kind: 'posting' }
  | { kind: 'done'; message: string }
  | { kind: 'already'; message: string }
  | { kind: 'error'; message: string }

export function ProductionBatchDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const query = useProductionBatch(id || undefined)
  const { submit, cancel } = useProductionBatchActions()
  const products = useProductOptions()
  const warehouses = useFactoryWarehouses()
  const [ledger, setLedger] = useState<LedgerState>({ kind: 'idle' })

  const batch = query.data

  const productName = useMemo(() => {
    if (!batch) return ''
    return (products.data ?? []).find((p) => p.$id === batch.product_id)?.name ?? batch.product_id
  }, [products.data, batch])

  const lots = useMemo(() => {
    if (!batch) return []
    const parsed = parseRawMaterialLots(batch.raw_material_lots)
    return parsed.ok ? parsed.value : []
  }, [batch])

  if (query.isLoading) return <p className="text-sm text-zinc-500">جارٍ التحميل…</p>
  if (query.isError) {
    return <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
  }
  if (!batch) return <Card className="text-sm text-zinc-500">لا يوجد أمر تشغيل بهذا المعرّف.</Card>

  async function postToLedger(current: ProductionBatch, postingDatetime: string) {
    const factory = warehouses.data?.factoryCustodyWarehouseId
    const rawStore = warehouses.data?.rawStoreWarehouseId
    if (!factory || !rawStore) {
      setLedger({
        kind: 'error',
        message: 'تعذّر تحديد مخزن عهدة المصنع أو مخزن الخامات. راجع بيانات المخازن.',
      })
      return
    }
    setLedger({ kind: 'posting' })
    const res = await postBatchToLedger(
      { ...current, posting_datetime: postingDatetime },
      { factoryCustodyWarehouseId: factory, rawStoreWarehouseId: rawStore },
    )
    if (res.ok) {
      setLedger({ kind: 'done', message: `تم ترحيل ${res.value.entries} حركة مخزون.` })
    } else if (isAlreadyPosted(res.error)) {
      setLedger({ kind: 'already', message: 'حركات المخزون لهذه التشغيلة مُرحّلة مسبقًا.' })
    } else {
      setLedger({ kind: 'error', message: res.error.message })
    }
    void query.refetch()
  }

  async function handleSubmit() {
    const transition = await submit.mutateAsync(batch!.$id).catch(() => null)
    if (!transition) return
    await postToLedger(batch!, transition.postingDatetime ?? batch!.posting_datetime)
  }

  const submitCancelError =
    (submit.isError && submit.error.message) || (cancel.isError && cancel.error.message) || null

  return (
    <div className="space-y-4">
      <PageHeader
        title={`أمر تشغيل ${batch.reference_id}`}
        titleEn="Production batch"
        actions={
          <Button variant="ghost" onClick={() => navigate('/manufacturing/batches')}>
            رجوع
          </Button>
        }
      />

      <Card className="grid gap-3 sm:grid-cols-2">
        <Fact label="المنتج" value={productName} />
        <Fact label="رقم التشغيلة" value={batch.lot_number} dir="ltr" />
        <Fact label="الكمية المنتجة" value={formatQuantity(batch.produced_qty)} dir="ltr" />
        <Fact label="كمية الهالك" value={formatQuantity(batch.waste_qty)} dir="ltr" />
        <Fact label="التكلفة المتوقعة" value={formatCurrency(batch.expected_cost)} dir="ltr" />
        <Fact label="الربح المتوقع" value={formatCurrency(batch.expected_profit)} dir="ltr" />
        <div className="text-sm">
          <span className="block text-zinc-500">فحص الجودة</span>
          <Badge tone={QC_STATUS_TONE[batch.qc_status]}>{QC_STATUS_LABEL[batch.qc_status]}</Badge>
        </div>
        <Fact label="التاريخ" value={formatDate(batch.posting_datetime)} dir="ltr" />
        {batch.production_request_ref ? (
          <Fact label="مرجع طلب الإنتاج" value={batch.production_request_ref} dir="ltr" />
        ) : null}
        {batch.expiry_date ? (
          <Fact label="تاريخ الانتهاء" value={batch.expiry_date} dir="ltr" />
        ) : null}
        {batch.remarks ? <Fact label="ملاحظات" value={batch.remarks} /> : null}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-sm font-semibold">الخامات المستهلكة / Consumed raw lots</h3>
        {lots.length === 0 ? (
          <p className="text-sm text-zinc-500">لا توجد خامات مسجّلة.</p>
        ) : (
          <ul className="divide-y divide-black/5 text-sm dark:divide-white/5">
            {lots.map((lot, i) => (
              <li key={`${lot.purchase_order_ref}-${i}`} className="flex justify-between py-1.5">
                <span dir="ltr">{lot.purchase_order_ref}</span>
                <span dir="ltr">{formatQuantity(lot.qty_consumed)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <QcActionBar
        batchId={batch.$id}
        qcStatus={batch.qc_status}
        docStatus={batch.doc_status}
        createdBy={batch.created_by}
        onDone={() => void query.refetch()}
      />

      <SubmitCancelBar
        docStatus={batch.doc_status}
        qcStatus={batch.qc_status}
        onSubmit={() => void handleSubmit()}
        onCancel={(reason) => cancel.mutate({ id: batch.$id, reason })}
        busy={submit.isPending || cancel.isPending || ledger.kind === 'posting'}
        error={submitCancelError}
      />

      <AdminOverridePanel
        table="production_batches"
        row={batch}
        onDone={() => void query.refetch()}
      />

      {batch.doc_status === DocStatus.Submitted ? (
        <Card className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">ترحيل المخزون / Stock ledger</h3>
            <Button
              size="sm"
              variant="secondary"
              disabled={ledger.kind === 'posting' || warehouses.isLoading}
              onClick={() => void postToLedger(batch, batch.posting_datetime)}
            >
              {ledger.kind === 'posting' ? 'جارٍ الترحيل…' : 'ترحيل المخزون'}
            </Button>
          </div>
          {ledger.kind === 'done' || ledger.kind === 'already' ? (
            <p className="text-emerald-700 dark:text-emerald-300">{ledger.message}</p>
          ) : null}
          {ledger.kind === 'error' ? (
            <p role="alert" className="text-red-600 dark:text-red-400">
              {ledger.message}
            </p>
          ) : null}
          {warehouses.isError ? (
            <p className="text-amber-600">تعذّر تحميل بيانات المخازن.</p>
          ) : null}
        </Card>
      ) : null}

      {ledger.kind === 'error' && batch.doc_status !== DocStatus.Submitted ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {ledger.message}
        </p>
      ) : null}
    </div>
  )
}

function Fact({ label, value, dir }: { label: string; value: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div className="text-sm">
      <span className="block text-zinc-500">{label}</span>
      <span dir={dir}>{value}</span>
    </div>
  )
}
