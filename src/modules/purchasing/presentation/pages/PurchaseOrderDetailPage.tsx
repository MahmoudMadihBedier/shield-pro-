/**
 * Read-only purchase-order view + lifecycle bar. Edit is a dialog (Draft only);
 * once Submitted a "Create receipt" shortcut opens the receipts screen.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { DocStatus } from '@/core/doc-status'
import { formatCurrency, formatDateTime, formatNumber } from '@/shared/formatters'
import { Button, Card, PageHeader } from '@/shared/ui'

import { parsePoLines, poTotal } from '../../domain/lines'
import { PO_FIELD_LABELS, PURCHASING_LABELS } from '../../domain/labels'
import { canActOnPurchasing } from '../../domain/permissions'
import { Dialog } from '../components/Dialog'
import { DocStatusPill } from '../components/DocStatusPill'
import { AdminOverridePanel } from '@/shared/documents'

import { SubmitCancelBar } from '../components/SubmitCancelBar'
import { usePurchaseOrder, usePurchaseOrderActions } from '../hooks/usePurchaseOrders'
import { useRawMaterialOptions, useSupplierOptions } from '../hooks/usePickerOptions'
import { PurchaseOrderFormPage } from './PurchaseOrderFormPage'

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { principal } = useAuth()
  const canAct = canActOnPurchasing(principal)

  const query = usePurchaseOrder(id)
  const actions = usePurchaseOrderActions()
  const suppliers = useSupplierOptions()
  const rawMaterials = useRawMaterialOptions()
  const [editOpen, setEditOpen] = useState(false)

  const rawMaterialNameById = useMemo(
    () => new Map((rawMaterials.data ?? []).map((option) => [option.value, option.label])),
    [rawMaterials.data],
  )

  if (query.isLoading) {
    return <p className="text-sm text-zinc-500">جارٍ تحميل أمر الشراء…</p>
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
  const order = query.data
  if (!order) {
    return <Card className="text-sm text-zinc-500">لا يوجد أمر شراء بهذا المعرّف.</Card>
  }

  const lines = parsePoLines(order.lines)
  const supplierName =
    suppliers.data?.find((option) => option.value === order.supplier_id)?.label ?? order.supplier_id

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${PURCHASING_LABELS.purchaseOrder.one.ar} ${order.reference_id}`}
        titleEn={PURCHASING_LABELS.purchaseOrder.one.en}
        actions={
          <div className="flex items-center gap-2">
            {canAct && order.doc_status === DocStatus.Draft ? (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                تعديل
              </Button>
            ) : null}
            {order.doc_status === DocStatus.Submitted ? (
              <Button
                onClick={() =>
                  navigate('/purchasing/receipts', { state: { poRef: order.reference_id } })
                }
              >
                إنشاء إذن استلام
              </Button>
            ) : null}
          </div>
        }
      />

      <Card className="space-y-2 text-sm">
        <Row label={PO_FIELD_LABELS.doc_status!.ar}>
          <DocStatusPill status={order.doc_status} />
        </Row>
        <Row label={PO_FIELD_LABELS.supplier_id!.ar}>{supplierName}</Row>
        <Row label={PO_FIELD_LABELS.posting_datetime!.ar}>
          {formatDateTime(order.posting_datetime)}
        </Row>
        <Row label={PO_FIELD_LABELS.total_value!.ar}>
          <span dir="ltr">{formatCurrency(order.total_value ?? poTotal(lines))}</span>
        </Row>
        {order.remarks ? <Row label="ملاحظات">{order.remarks}</Row> : null}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">بنود أمر الشراء</h3>
        {lines.length === 0 ? (
          <p className="text-sm text-zinc-500">لا توجد بنود.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="p-2 text-start">{PO_FIELD_LABELS.raw_material_id!.ar}</th>
                  <th className="p-2 text-end">{PO_FIELD_LABELS.qty!.ar}</th>
                  <th className="p-2 text-end">{PO_FIELD_LABELS.unit_price!.ar}</th>
                  <th className="p-2 text-end">{PO_FIELD_LABELS.line_total!.ar}</th>
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
                    <td className="p-2 text-end" dir="ltr">
                      {formatCurrency(line.qty * line.unit_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="space-y-2">
        <SubmitCancelBar
          docStatus={order.doc_status}
          canAct={canAct}
          isPending={actions.isPending}
          onSubmit={() => actions.submit(order.$id)}
          onCancel={(reason) => actions.cancel(order.$id, reason)}
        />
        <p className="text-xs text-zinc-500">
          <Link to="/purchasing/orders" className="underline">
            العودة إلى قائمة أوامر الشراء
          </Link>
        </p>
      </Card>

      <AdminOverridePanel table="purchase_orders" row={order} onDone={() => void query.refetch()} />

      <Dialog
        open={editOpen}
        title={`تعديل ${order.reference_id}`}
        titleEn="Edit purchase order"
        onClose={() => setEditOpen(false)}
      >
        <PurchaseOrderFormPage mode="edit" order={order} onDone={() => setEditOpen(false)} />
      </Dialog>
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
