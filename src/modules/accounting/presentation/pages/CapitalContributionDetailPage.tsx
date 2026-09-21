/**
 * One capital contribution: envelope, the Draft→Submit / Submitted→Cancel bar,
 * and — once submitted — the action that posts it to the general ledger
 * (`Dr <asset_account> / Cr owners_capital`, idempotent by `voucher_no`).
 */
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { DocStatus } from '@/core/doc-status'
import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import { AdminOverridePanel, DocumentLetterhead } from '@/shared/documents'
import { formatCurrency, formatDateTime } from '@/shared/formatters'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { postCapitalToGl, reverseGlPosting, type GlPosting } from '../../data/post-accounting'
import { CAPITAL_ASSET_TYPE_LABELS } from '../../domain/labels'
import type { CapitalContribution } from '../../domain/schemas'
import { AmendPanel, Dialog, DocStatusPill, SubmitCancelBar } from '../components'
import {
  useAccountingPermissions,
  useCapitalContribution,
  useCapitalContributionActions,
} from '../hooks'
import { CapitalContributionFormPage } from './CapitalContributionFormPage'

export function CapitalContributionDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const perms = useAccountingPermissions()

  const query = useCapitalContribution(id)
  const { createDraft, submit, cancel } = useCapitalContributionActions()

  const [actionError, setActionError] = useState<string | null>(null)
  const [posting, setPosting] = useState<GlPosting | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [amendPending, setAmendPending] = useState(false)

  async function handleAmend(row: CapitalContribution, reason: string) {
    setAmendPending(true)
    setActionError(null)
    try {
      const reversed = await reverseGlPosting(row.reference_id, reason)
      if (isErr(reversed)) throw reversed.error
      if (row.doc_status === DocStatus.Submitted) {
        await cancel.mutateAsync({ id: row.$id, reason })
      }
      const amended = await createDraft.mutateAsync({
        fields: {
          contributor: row.contributor,
          asset_type: row.asset_type,
          description: row.description ?? null,
          amount: row.amount,
          asset_account: row.asset_account,
        },
        extras: {
          amendedFrom: row.reference_id,
          remarks: `تعديل لـ ${row.reference_id}: ${reason}`,
        },
      })
      navigate(`/accounting/capital/${amended.$id}`)
    } catch (e) {
      setActionError((e as AppError).message ?? 'تعذّر تنفيذ التعديل.')
    } finally {
      setAmendPending(false)
    }
  }

  const postGlMutation = useMutation<GlPosting, AppError, CapitalContribution>({
    mutationFn: async (row) => {
      const result = await postCapitalToGl(row)
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
      <DocumentLetterhead reference={row?.reference_id} />
      <PageHeader
        title={`رأس مال ${row?.reference_id ?? ''}`}
        titleEn="Capital contribution"
        actions={
          <div className="flex items-center gap-2">
            {row && row.doc_status === DocStatus.Draft && perms.canRecord ? (
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                تعديل
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => navigate('/accounting/capital')}>
              رجوع
            </Button>
          </div>
        }
      />

      {query.isLoading ? <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card> : null}
      {query.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
      ) : null}
      {!query.isLoading && !query.isError && !row ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">لم يُعثر على الإدخال.</Card>
      ) : null}

      {row ? (
        <>
          <Card className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <DocStatusPill status={row.doc_status} />
              <Badge tone="neutral">{CAPITAL_ASSET_TYPE_LABELS[row.asset_type].ar}</Badge>
              <span dir="ltr" className="text-zinc-500">
                {formatDateTime(row.posting_datetime)}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              <div className="flex justify-between">
                <dt className="text-zinc-500">المساهم / Contributor</dt>
                <dd>{row.contributor}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">القيمة / Amount</dt>
                <dd dir="ltr" className="font-semibold">
                  {formatCurrency(row.amount)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">حساب الأصل / Asset account</dt>
                <dd dir="ltr">{row.asset_account}</dd>
              </div>
            </dl>
            {row.description ? (
              <p className="text-zinc-600 dark:text-zinc-400">الوصف: {row.description}</p>
            ) : null}
            {row.amended_from ? (
              <p className="text-xs text-zinc-500">
                تعديل لـ / Amendment of <span dir="ltr">{row.amended_from}</span>
              </p>
            ) : null}
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

            {row.doc_status === DocStatus.Submitted || row.doc_status === DocStatus.Cancelled ? (
              <div className="mt-3">
                <AmendPanel
                  canAmend={perms.isSenior}
                  pending={amendPending || busy}
                  onAmend={(reason) => void handleAmend(row, reason)}
                />
              </div>
            ) : null}
          </Card>

          <AdminOverridePanel
            table="capital_contributions"
            row={row}
            onDone={() => void query.refetch()}
          />

          <Dialog
            open={editOpen}
            title="تعديل إدخال رأس مال"
            titleEn="Edit capital contribution"
            onClose={() => setEditOpen(false)}
          >
            <CapitalContributionFormPage
              mode="edit"
              contribution={row}
              onDone={() => {
                setEditOpen(false)
                void query.refetch()
              }}
            />
          </Dialog>

          {actionError ? (
            <Card className="text-sm text-red-600 dark:text-red-400">{actionError}</Card>
          ) : null}

          {posting ? (
            <Card className="space-y-1 text-sm">
              <div className="font-semibold">دفتر الأستاذ</div>
              {posting.alreadyPosted ? (
                <p className="text-zinc-500">سبق ترحيل هذا الإدخال — لا تغيير.</p>
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
