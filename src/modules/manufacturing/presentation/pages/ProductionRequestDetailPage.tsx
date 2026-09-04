/**
 * One production request: header facts, the frozen `required_materials`
 * breakdown, the `pending → approved → issued` workflow buttons (guarded by
 * `canRequestTransition`), and the shared Submit / Cancel bar.
 */
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { DocStatus } from '@/core/doc-status'
import { formatDate, formatQuantity } from '@/shared/formatters'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { parseRequiredMaterials } from '../../domain/planning'
import { canRequestTransition } from '../../domain/request-status'
import { PRODUCTION_REQUEST_STATUSES, type ProductionRequestStatus } from '../../domain/schemas'
import { SubmitCancelBar } from '../components/SubmitCancelBar'
import { useProductOptions, useRawMaterialOptions } from '../hooks/catalog'
import { useProductionRequest, useProductionRequestActions } from '../hooks/documents'
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE } from '../labels'

const TRANSITION_LABEL: Record<ProductionRequestStatus, string> = {
  pending: 'إعادة إلى الانتظار',
  approved: 'اعتماد الطلب',
  rejected: 'رفض الطلب',
  issued: 'تحديد كمُصدر',
}

export function ProductionRequestDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const query = useProductionRequest(id || undefined)
  const { updateDraft, submit, cancel } = useProductionRequestActions()
  const products = useProductOptions()
  const rawMaterials = useRawMaterialOptions()

  const request = query.data

  const rawMaterialName = useMemo(() => {
    const map = new Map((rawMaterials.data ?? []).map((rm) => [rm.$id, rm.name]))
    return (rmId: string) => map.get(rmId) ?? rmId
  }, [rawMaterials.data])

  const productName = useMemo(() => {
    if (!request) return ''
    return (products.data ?? []).find((p) => p.$id === request.product_id)?.name ?? request.product_id
  }, [products.data, request])

  const required = useMemo(() => {
    if (!request) return []
    const parsed = parseRequiredMaterials(request.required_materials)
    return parsed.ok ? parsed.value : []
  }, [request])

  if (query.isLoading) {
    return <p className="text-sm text-zinc-500">جارٍ التحميل…</p>
  }
  if (query.isError) {
    return (
      <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
    )
  }
  if (!request) {
    return <Card className="text-sm text-zinc-500">لا يوجد طلب بهذا المعرّف.</Card>
  }

  // The business `status` workflow runs while the request is still a Draft;
  // once Submitted the row is server-locked and `updateDraft` would be rejected.
  const workflowOpen = request.doc_status === DocStatus.Draft
  const nextStatuses = workflowOpen
    ? PRODUCTION_REQUEST_STATUSES.filter((s) => canRequestTransition(request.status, s))
    : []
  const actionError =
    (updateDraft.isError && updateDraft.error.message) ||
    (submit.isError && submit.error.message) ||
    (cancel.isError && cancel.error.message) ||
    null

  return (
    <div className="space-y-4">
      <PageHeader
        title={`طلب إنتاج ${request.reference_id}`}
        titleEn="Production request"
        actions={
          <Button variant="ghost" onClick={() => navigate('/manufacturing/requests')}>
            رجوع
          </Button>
        }
      />

      <Card className="grid gap-3 sm:grid-cols-2">
        <Fact label="المنتج" value={productName} />
        <Fact label="الكمية المخططة" value={formatQuantity(request.planned_qty)} dir="ltr" />
        <div className="text-sm">
          <span className="block text-zinc-500">حالة الطلب</span>
          <Badge tone={REQUEST_STATUS_TONE[request.status]}>
            {REQUEST_STATUS_LABEL[request.status]}
          </Badge>
        </div>
        <Fact label="التاريخ" value={formatDate(request.posting_datetime)} dir="ltr" />
        {request.remarks ? <Fact label="ملاحظات" value={request.remarks} /> : null}
      </Card>

      <Card className="space-y-2">
        <h3 className="text-sm font-semibold">المواد المطلوبة / Required materials</h3>
        {required.length === 0 ? (
          <p className="text-sm text-zinc-500">لا توجد مواد مسجّلة على هذا الطلب.</p>
        ) : (
          <ul className="divide-y divide-black/5 text-sm dark:divide-white/5">
            {required.map((line) => (
              <li key={line.raw_material_id} className="flex justify-between py-1.5">
                <span>{rawMaterialName(line.raw_material_id)}</span>
                <span dir="ltr">{formatQuantity(line.qty)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {nextStatuses.length > 0 ? (
        <Card className="space-y-2">
          <h3 className="text-sm font-semibold">سير العمل / Workflow</h3>
          {actionError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {actionError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((next) => (
              <Button
                key={next}
                variant={next === 'rejected' ? 'danger' : 'primary'}
                disabled={updateDraft.isPending}
                onClick={() => updateDraft.mutate({ id: request.$id, patch: { status: next } })}
              >
                {TRANSITION_LABEL[next]}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      <SubmitCancelBar
        docStatus={request.doc_status}
        onSubmit={() => submit.mutate(request.$id)}
        onCancel={(reason) => cancel.mutate({ id: request.$id, reason })}
        busy={submit.isPending || cancel.isPending}
        error={actionError}
      />
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
