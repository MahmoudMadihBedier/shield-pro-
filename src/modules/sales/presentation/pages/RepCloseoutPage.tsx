/**
 * One rep daily close-out. `open` → the account manager fills the expected bag
 * (issued/sold/returned/remaining + expected cash) and the rep's physical count
 * → **submit** computes and stores `stock_variance` / `cash_variance` and moves
 * the status to `submitted`. A manager then **confirms**: `confirmed` when it
 * ties out, or auto-`flagged` when the reconciliation raises any flag. On
 * confirm the rep's stock + cash ledgers are shown.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import type { AppError } from '@/core/errors'
import { formatCurrency, formatDateTime, formatNumber } from '@/shared/formatters'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { closeoutOutcomeStatus, reconcileCloseout } from '../../domain/closeout'
import { canActOnSales, canManageSales } from '../../domain/permissions'
import {
  closeoutActualSchema,
  closeoutExpectedSchema,
  parseCloseoutActual,
  parseCloseoutExpected,
  type CloseoutActual,
  type CloseoutExpected,
} from '../../domain/schemas'
import { CloseoutSheet, DocStatusPill } from '../components'
import {
  optionLabelMap,
  useProductOptions,
  useRepCashLedger,
  useRepCloseout,
  useRepCloseoutActions,
  useRepOptions,
  useRepStockLedger,
} from '../hooks'
import { CLOSEOUT_STATUS_LABEL, CLOSEOUT_STATUS_TONE } from '../labels'

const EMPTY_EXPECTED: CloseoutExpected = { products: [], cash: [] }
const EMPTY_ACTUAL: CloseoutActual = { products: [], cash: [] }

function safeExpected(raw: string | null | undefined): CloseoutExpected {
  try {
    return parseCloseoutExpected(raw) ?? EMPTY_EXPECTED
  } catch {
    return EMPTY_EXPECTED
  }
}
function safeActual(raw: string | null | undefined): CloseoutActual {
  try {
    return parseCloseoutActual(raw) ?? EMPTY_ACTUAL
  } catch {
    return EMPTY_ACTUAL
  }
}

export function RepCloseoutPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { principal } = useAuth()
  const canAct = canActOnSales(principal)
  const canManage = canManageSales(principal)

  const query = useRepCloseout(id)
  const actions = useRepCloseoutActions()
  const products = useProductOptions()
  const reps = useRepOptions()
  const productLabel = useMemo(() => optionLabelMap(products.data), [products.data])
  const repLabel = useMemo(() => optionLabelMap(reps.data), [reps.data])

  const row = query.data

  const [draftExpected, setDraftExpected] = useState<CloseoutExpected | null>(null)
  const [draftActual, setDraftActual] = useState<CloseoutActual | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const expected = draftExpected ?? (row ? safeExpected(row.expected) : EMPTY_EXPECTED)
  const actual = draftActual ?? (row ? safeActual(row.actual) : EMPTY_ACTUAL)

  const reconciliation = useMemo(() => reconcileCloseout(expected, actual), [expected, actual])

  const isEditable = row?.status === 'open'
  const busy = actions.updateDraft.isPending || actions.submit.isPending

  const stockLedger = useRepStockLedger({
    repUserId: row && row.status === 'confirmed' ? row.rep_user_id : undefined,
    pageSize: 50,
  })
  const cashLedger = useRepCashLedger({
    repUserId: row && row.status === 'confirmed' ? row.rep_user_id : undefined,
    pageSize: 50,
  })

  const save = async () => {
    if (!row) return
    setActionError(null)
    const expParsed = closeoutExpectedSchema.safeParse(expected)
    const actParsed = closeoutActualSchema.safeParse(actual)
    if (!expParsed.success || !actParsed.success) {
      setActionError('تحقّق من صحة الأرقام المُدخلة.')
      return
    }
    try {
      await actions.updateDraft.mutateAsync({
        id: row.$id,
        patch: {
          expected: JSON.stringify(expParsed.data),
          actual: JSON.stringify(actParsed.data),
        },
      })
      setDraftExpected(null)
      setDraftActual(null)
    } catch (e) {
      setActionError((e as AppError)?.message ?? 'تعذّر الحفظ.')
    }
  }

  const submitCloseout = async () => {
    if (!row) return
    setActionError(null)
    try {
      await actions.updateDraft.mutateAsync({
        id: row.$id,
        patch: {
          expected: JSON.stringify(expected),
          actual: JSON.stringify(actual),
          stock_variance: reconciliation.stock_variance,
          cash_variance: reconciliation.cash_variance,
          status: 'submitted',
        },
      })
      setDraftExpected(null)
      setDraftActual(null)
    } catch (e) {
      setActionError((e as AppError)?.message ?? 'تعذّر التقديم.')
    }
  }

  const confirmCloseout = async () => {
    if (!row) return
    setActionError(null)
    const outcome = closeoutOutcomeStatus(reconciliation)
    try {
      await actions.updateDraft.mutateAsync({
        id: row.$id,
        patch: {
          stock_variance: reconciliation.stock_variance,
          cash_variance: reconciliation.cash_variance,
          status: outcome,
          confirmed_by: principal?.userId ?? null,
        },
      })
      await actions.submit.mutateAsync(row.$id).catch(() => undefined)
    } catch (e) {
      setActionError((e as AppError)?.message ?? 'تعذّر التأكيد.')
    }
  }

  if (query.isLoading) return <p className="text-sm text-zinc-500">جارٍ تحميل التقفيل…</p>
  if (query.isError) {
    return <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
  }
  if (!row) return <Card className="text-sm text-zinc-500">لا يوجد تقفيل بهذا المعرّف.</Card>

  return (
    <div className="space-y-5">
      <PageHeader
        title={`تقفيل ${row.reference_id}`}
        titleEn="Rep daily close-out"
        actions={
          <Button variant="ghost" onClick={() => navigate('/sales/closeouts')}>
            رجوع
          </Button>
        }
      />

      <Card className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <DocStatusPill status={row.doc_status} />
          <Badge tone={CLOSEOUT_STATUS_TONE[row.status]}>{CLOSEOUT_STATUS_LABEL[row.status]}</Badge>
        </div>
        <div>المندوب: {repLabel.get(row.rep_user_id) ?? row.rep_user_id}</div>
        <div dir="ltr">يوم العمل: {row.business_date}</div>
        <div dir="ltr" className="text-zinc-500">
          {formatDateTime(row.posting_datetime)}
        </div>
      </Card>

      <Card>
        <CloseoutSheet
          expected={expected}
          actual={actual}
          onActualChange={isEditable ? setDraftActual : () => undefined}
          onExpectedChange={isEditable && canManage ? setDraftExpected : undefined}
          productLabelById={productLabel}
          productOptions={(products.data ?? []).map((o) => ({ value: o.value, label: o.label }))}
          disabled={!isEditable || busy}
        />
      </Card>

      {isEditable ? (
        <Card className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy || !canAct} onClick={() => void save()}>
            حفظ
          </Button>
          <Button disabled={busy || !canAct} onClick={() => void submitCloseout()}>
            تقديم واحتساب الفروقات
          </Button>
        </Card>
      ) : null}

      {row.status === 'submitted' ? (
        <Card className="space-y-2">
          <p className="text-sm">
            فرق المخزون: <strong dir="ltr">{formatNumber(row.stock_variance)}</strong> — فرق
            النقدية: <strong dir="ltr">{formatCurrency(row.cash_variance)}</strong>
          </p>
          {canManage ? (
            <Button disabled={busy} onClick={() => void confirmCloseout()}>
              تأكيد التقفيل
              {reconciliation.flags.length > 0 ? ' (سيُوسم بوجود فروقات)' : ''}
            </Button>
          ) : (
            <p className="text-xs text-zinc-500">بانتظار تأكيد مدير الحسابات.</p>
          )}
        </Card>
      ) : null}

      {actionError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{actionError}</Card>
      ) : null}

      {row.status === 'confirmed' || row.status === 'flagged' ? (
        <Card className="space-y-1 text-sm">
          <div className="font-semibold">نتيجة التقفيل: {CLOSEOUT_STATUS_LABEL[row.status]}</div>
          <p className="text-zinc-500">
            فرق المخزون <span dir="ltr">{formatNumber(row.stock_variance)}</span> — فرق النقدية{' '}
            <span dir="ltr">{formatCurrency(row.cash_variance)}</span>
          </p>
        </Card>
      ) : null}

      {row.status === 'confirmed' ? (
        <RepLedgersPanel
          stockRows={stockLedger.data?.rows ?? []}
          cashRows={cashLedger.data?.rows ?? []}
          loading={stockLedger.isLoading || cashLedger.isLoading}
          productLabel={productLabel}
        />
      ) : null}
    </div>
  )
}

function RepLedgersPanel({
  stockRows,
  cashRows,
  loading,
  productLabel,
}: {
  stockRows: {
    $id: string
    product_id: string
    voucher_no: string
    qty_change: number
    qty_after: number
  }[]
  cashRows: {
    $id: string
    voucher_no: string
    method?: string | null
    amount_change: number
    amount_after: number
  }[]
  loading: boolean
  productLabel: ReadonlyMap<string, string>
}) {
  if (loading) return <Card className="text-sm text-zinc-500">جارٍ تحميل دفاتر المندوب…</Card>
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-2 text-sm font-semibold">دفتر عهدة المندوب / Rep stock ledger</h3>
        {stockRows.length === 0 ? (
          <p className="text-sm text-zinc-500">لا توجد حركات.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="p-2 text-start">الصنف</th>
                <th className="p-2 text-end">تغيّر</th>
                <th className="p-2 text-end">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {stockRows.map((r) => (
                <tr key={r.$id} className="border-t border-black/5 dark:border-white/5">
                  <td className="p-2">{productLabel.get(r.product_id) ?? r.product_id}</td>
                  <td className="p-2 text-end" dir="ltr">
                    {formatNumber(r.qty_change)}
                  </td>
                  <td className="p-2 text-end" dir="ltr">
                    {formatNumber(r.qty_after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card>
        <h3 className="mb-2 text-sm font-semibold">دفتر نقدية المندوب / Rep cash ledger</h3>
        {cashRows.length === 0 ? (
          <p className="text-sm text-zinc-500">لا توجد حركات.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="p-2 text-start">الطريقة</th>
                <th className="p-2 text-end">تغيّر</th>
                <th className="p-2 text-end">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {cashRows.map((r) => (
                <tr key={r.$id} className="border-t border-black/5 dark:border-white/5">
                  <td className="p-2">{r.method ?? '—'}</td>
                  <td className="p-2 text-end" dir="ltr">
                    {formatCurrency(r.amount_change)}
                  </td>
                  <td className="p-2 text-end" dir="ltr">
                    {formatCurrency(r.amount_after)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
