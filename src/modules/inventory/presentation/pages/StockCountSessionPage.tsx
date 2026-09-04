/**
 * One stock-count session. `open` → fill the `CountSheet` (recorded qty comes
 * from `bin_balances` for the session warehouse) → submit, which computes and
 * stores the variances. A System Admin then signs off, which posts the
 * reconciling adjustment to the stock ledger.
 */
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import { formatNumber } from '@/shared/formatters'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { postCountAdjustmentToLedger, type LedgerPostResult } from '../../data/post-movement'
import {
  computeVariances,
  parseCounts,
  parseVariances,
  serializeCounts,
  serializeVariances,
} from '../../domain/variance'
import type { CountLine, StockCountSessionRow } from '../../domain/schemas'
import { CountSheet } from '../components'
import {
  optionLabelMap,
  useBinBalances,
  useInventoryPermissions,
  useProductOptions,
  useStockCountSession,
  useStockCountSessionActions,
} from '../hooks'
import { COUNT_STATUS_LABEL, COUNT_STATUS_TONE } from '../labels'

export function StockCountSessionPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const perms = useInventoryPermissions()

  const query = useStockCountSession(id)
  const { updateDraft, submit } = useStockCountSessionActions()
  const products = useProductOptions()
  const productLabel = useMemo(() => optionLabelMap(products.data), [products.data])

  const row = query.data
  const bins = useBinBalances(
    row ? { warehouseId: row.warehouse_id, pageSize: 500 } : { pageSize: 1 },
  )
  const recordedByProduct = useMemo(
    () => new Map((bins.data?.rows ?? []).map((b) => [b.product_id, b.qty] as const)),
    [bins.data],
  )

  const [draftCounts, setDraftCounts] = useState<CountLine[] | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerPostResult | null>(null)

  const counts = useMemo<CountLine[]>(() => {
    if (draftCounts) return draftCounts
    if (!row) return []
    return safeParse(() => parseCounts(row.counts))
  }, [draftCounts, row])

  const storedVariances = useMemo(
    () => (row ? safeParse(() => parseVariances(row.variances)) : []),
    [row],
  )

  const liveVariances = useMemo(
    () => computeVariances(counts, recordedByProduct),
    [counts, recordedByProduct],
  )

  const signOff = useMutation<LedgerPostResult, AppError, StockCountSessionRow>({
    mutationFn: async (session) => {
      const variances = parseVariances(session.variances)
      const result = await postCountAdjustmentToLedger(
        {
          reference_id: session.reference_id,
          warehouse_id: session.warehouse_id,
          posting_datetime: session.posting_datetime,
        },
        variances,
      )
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: (value) => setLedger(value),
  })

  const submitCounts = async () => {
    if (!row) return
    setActionError(null)
    try {
      await updateDraft.mutateAsync({
        id: row.$id,
        patch: {
          counts: serializeCounts(counts),
          variances: serializeVariances(liveVariances),
          status: 'submitted',
        },
      })
      setDraftCounts(null)
    } catch (e) {
      setActionError(errText(e))
    }
  }

  const doSignOff = async () => {
    if (!row || !perms.principal) return
    setActionError(null)
    try {
      await updateDraft.mutateAsync({
        id: row.$id,
        patch: { status: 'signed_off', signed_off_by: perms.principal.userId },
      })
      await signOff.mutateAsync(row)
      await submit.mutateAsync(row.$id).catch(() => undefined)
    } catch (e) {
      setActionError(errText(e))
    }
  }

  const busy = updateDraft.isPending || submit.isPending || signOff.isPending

  return (
    <div className="space-y-4">
      <PageHeader
        title={`جلسة جرد ${row?.reference_id ?? ''}`}
        titleEn="Stock count session"
        actions={
          <Button variant="ghost" onClick={() => navigate('/inventory/counts')}>
            رجوع
          </Button>
        }
      />

      {query.isLoading ? <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card> : null}
      {query.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
      ) : null}
      {!query.isLoading && !query.isError && !row ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">لم يُعثر على الجلسة.</Card>
      ) : null}

      {row ? (
        <>
          <Card className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={COUNT_STATUS_TONE[row.status]}>{COUNT_STATUS_LABEL[row.status]}</Badge>
            <span className="text-zinc-500">المخزن: {row.warehouse_id}</span>
          </Card>

          {row.status === 'open' ? (
            <Card className="space-y-3">
              {bins.isLoading ? (
                <p className="text-sm text-zinc-500">جارٍ تحميل الأرصدة المسجّلة…</p>
              ) : null}
              <CountSheet
                value={counts}
                onChange={setDraftCounts}
                recordedByProduct={recordedByProduct}
                productOptions={products.data ?? []}
                disabled={busy}
              />
              <Button
                disabled={busy || counts.length === 0}
                onClick={() => void submitCounts()}
              >
                تقديم الجرد واحتساب الفروقات
              </Button>
            </Card>
          ) : (
            <Card className="p-0">
              <table className="w-full text-start text-sm">
                <thead className="bg-black/[0.02] text-xs text-zinc-500 dark:bg-white/[0.03]">
                  <tr>
                    <th className="p-3 text-start font-semibold">الصنف / Product</th>
                    <th className="p-3 text-end font-semibold">المسجّل / Recorded</th>
                    <th className="p-3 text-end font-semibold">المعدود / Counted</th>
                    <th className="p-3 text-end font-semibold">الفرق / Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {storedVariances.map((line, index) => (
                    <tr key={index} className="border-t border-black/5 dark:border-white/5">
                      <td className="p-3">{productLabel.get(line.product_id) ?? line.product_id}</td>
                      <td className="p-3 text-end" dir="ltr">
                        {formatNumber(line.recorded_qty)}
                      </td>
                      <td className="p-3 text-end" dir="ltr">
                        {formatNumber(line.counted_qty)}
                      </td>
                      <td
                        className={`p-3 text-end tabular-nums ${
                          line.variance === 0
                            ? 'text-zinc-500'
                            : line.variance > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                        }`}
                        dir="ltr"
                      >
                        {line.variance > 0 ? '+' : ''}
                        {formatNumber(line.variance)}
                      </td>
                    </tr>
                  ))}
                  {storedVariances.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-zinc-500">
                        لا توجد فروقات مسجّلة.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </Card>
          )}

          {row.status === 'submitted' && perms.canSignOffCount ? (
            <Button disabled={busy} onClick={() => void doSignOff()}>
              اعتماد نهائي وترحيل التسوية
            </Button>
          ) : null}

          {actionError ? (
            <Card className="text-sm text-red-600 dark:text-red-400">{actionError}</Card>
          ) : null}

          {ledger ? (
            <Card className="space-y-1 text-sm">
              <div className="font-semibold">تسوية المخزون</div>
              {ledger.alreadyPosted ? (
                <p className="text-zinc-500">سبق ترحيل هذه التسوية — لا تغيير.</p>
              ) : (
                <p className="text-zinc-500">
                  تم ترحيل {formatNumber(ledger.posted?.entries ?? 0)} قيد تسوية تحت السند{' '}
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

function safeParse<T>(fn: () => T[]): T[] {
  try {
    return fn()
  } catch {
    return []
  }
}

function errText(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as AppError).message)
  return 'تعذّر تنفيذ الإجراء.'
}
