/**
 * One payment voucher: envelope, the Draft→Submit / Submitted→Cancel bar, and
 * — once submitted — the action that posts it to the general ledger
 * (idempotent by `voucher_no`).
 */
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { DocStatus } from '@/core/doc-status'
import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import { formatCurrency, formatDateTime } from '@/shared/formatters'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { postVoucherToGl, type GlPosting } from '../../data/post-accounting'
import { VOUCHER_DIRECTION_LABELS } from '../../domain/labels'
import type { PaymentVoucher } from '../../domain/schemas'
import { DocStatusPill, SubmitCancelBar } from '../components'
import { useAccountingPermissions, usePaymentVoucher, usePaymentVoucherActions } from '../hooks'

export function PaymentVoucherDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const perms = useAccountingPermissions()

  const query = usePaymentVoucher(id)
  const { submit, cancel } = usePaymentVoucherActions()

  const [actionError, setActionError] = useState<string | null>(null)
  const [posting, setPosting] = useState<GlPosting | null>(null)

  const postGlMutation = useMutation<GlPosting, AppError, PaymentVoucher>({
    mutationFn: async (voucher) => {
      const result = await postVoucherToGl(voucher)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: setPosting,
    onError: (e) => setActionError(e.message),
  })

  const row = query.data
  const busy = submit.isPending || cancel.isPending || postGlMutation.isPending

  return (
    <div className="space-y-4">
      <PageHeader
        title={`سند ${row?.reference_id ?? ''}`}
        titleEn="Voucher"
        actions={
          <Button variant="ghost" onClick={() => navigate('/accounting/vouchers')}>
            رجوع
          </Button>
        }
      />

      {query.isLoading ? <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card> : null}
      {query.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
      ) : null}
      {!query.isLoading && !query.isError && !row ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">لم يُعثر على السند.</Card>
      ) : null}

      {row ? (
        <>
          <Card className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <DocStatusPill status={row.doc_status} />
              <Badge tone="neutral">{VOUCHER_DIRECTION_LABELS[row.direction].ar}</Badge>
              <span dir="ltr" className="text-zinc-500">
                {formatDateTime(row.posting_datetime)}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <div className="flex justify-between">
                <dt className="text-zinc-500">المبلغ / Amount</dt>
                <dd dir="ltr" className="font-semibold">
                  {formatCurrency(row.amount)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">الطرف / Counterparty</dt>
                <dd>{row.counterparty || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">الخزينة / Treasury</dt>
                <dd dir="ltr">{row.treasury_account || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">المرفق / Evidence</dt>
                <dd dir="ltr">{row.evidence_file_id || '—'}</dd>
              </div>
            </dl>
            <p className="text-zinc-600 dark:text-zinc-400">السبب: {row.reason}</p>
          </Card>

          <Card>
            <SubmitCancelBar
              docStatus={row.doc_status}
              pending={busy}
              canSubmit={perms.canSubmit}
              canCancel={perms.canCancel}
              onSubmit={() =>
                void submit.mutateAsync(row.$id).catch((e: AppError) => setActionError(e.message))
              }
              onCancel={(reason) =>
                void cancel
                  .mutateAsync({ id: row.$id, reason })
                  .catch((e: AppError) => setActionError(e.message))
              }
            />

            {row.doc_status === DocStatus.Submitted && perms.canPostGl && !posting ? (
              <Button
                className="mt-3"
                disabled={busy}
                onClick={() => void postGlMutation.mutateAsync(row)}
              >
                ترحيل إلى دفتر الأستاذ / Post to GL
              </Button>
            ) : null}
          </Card>

          {actionError ? (
            <Card className="text-sm text-red-600 dark:text-red-400">{actionError}</Card>
          ) : null}

          {posting ? (
            <Card className="space-y-1 text-sm">
              <div className="font-semibold">دفتر الأستاذ</div>
              {posting.alreadyPosted ? (
                <p className="text-zinc-500">سبق ترحيل هذا السند — لا تغيير.</p>
              ) : (
                <p className="text-zinc-500">
                  تم ترحيل {posting.posted?.entries ?? 0} قيد تحت السند{' '}
                  <span dir="ltr">{posting.voucherNo}</span>.
                </p>
              )}
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
