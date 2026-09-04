import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'

import { formatCurrency, formatDateTime, formatNumber } from '@/shared/formatters'
import { Button, Card, PageHeader } from '@/shared/ui'

import { PortalDocStatusBadge } from '../components/PortalDocStatusBadge'
import { usePortalInvoiceDetail } from '../hooks'
import { portalPaymentMethodLabel } from '../labels'

/** Mirrors the sales-invoice `lines` JSON shape (`scripts/appwrite/schema.ts`
 *  comment) defensively — the portal has no other access to the products
 *  catalog, so a line only shows what the invoice itself carries. */
const lineSchema = z.object({
  product_id: z.string(),
  qty: z.number(),
  base_price: z.number(),
  discount_pct: z.number().optional().default(0),
  net_price: z.number(),
})
type InvoiceLine = z.infer<typeof lineSchema>

function parseLines(raw: string): InvoiceLine[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => lineSchema.safeParse(entry))
      .filter((r): r is { success: true; data: InvoiceLine } => r.success)
      .map((r) => r.data)
  } catch {
    return []
  }
}

export function PortalInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const query = usePortalInvoiceDetail(id)

  if (query.isLoading) return <p className="text-sm text-zinc-500">جارٍ تحميل الفاتورة…</p>

  if (query.isError) {
    const notFound = query.error.code === 'not_found'
    const forbidden = query.error.code === 'forbidden'
    return (
      <Card className="space-y-2 text-sm">
        <p className="text-red-600 dark:text-red-400">
          {notFound
            ? 'هذه الفاتورة غير موجودة.'
            : forbidden
              ? 'لا تملك صلاحية عرض هذه الفاتورة.'
              : query.error.message}
        </p>
        {!notFound && !forbidden ? (
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </button>
        ) : null}
        <p>
          <Link to="/portal/invoices" className="underline">
            العودة إلى قائمة الفواتير
          </Link>
        </p>
      </Card>
    )
  }

  const invoice = query.data
  if (!invoice) return <Card className="text-sm text-zinc-500">لا توجد فاتورة بهذا المعرّف.</Card>

  const lines = parseLines(invoice.lines)

  return (
    <div className="space-y-5">
      <PageHeader
        title={`فاتورة ${invoice.referenceId}`}
        actions={
          <Button variant="ghost" onClick={() => navigate('/portal/invoices')}>
            رجوع
          </Button>
        }
      />

      <Card className="space-y-2 text-sm">
        <Row label="الحالة">
          <PortalDocStatusBadge status={invoice.docStatus} />
        </Row>
        <Row label="طريقة الدفع">{portalPaymentMethodLabel(invoice.paymentMethod)}</Row>
        <Row label="التاريخ">{formatDateTime(invoice.postingDatetime)}</Row>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">بنود الفاتورة</h3>
        {lines.length === 0 ? (
          <p className="text-sm text-zinc-500">لا توجد بنود.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="p-2 text-start">الصنف</th>
                  <th className="p-2 text-end">الكمية</th>
                  <th className="p-2 text-end">السعر</th>
                  <th className="p-2 text-end">خصم٪</th>
                  <th className="p-2 text-end">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr
                    key={`${line.product_id}-${index}`}
                    className="border-t border-black/5 dark:border-white/5"
                  >
                    <td className="p-2" dir="ltr">
                      {line.product_id}
                    </td>
                    <td className="p-2 text-end" dir="ltr">
                      {formatNumber(line.qty)}
                    </td>
                    <td className="p-2 text-end" dir="ltr">
                      {formatCurrency(line.base_price)}
                    </td>
                    <td className="p-2 text-end" dir="ltr">
                      {formatNumber(line.discount_pct)}
                    </td>
                    <td className="p-2 text-end" dir="ltr">
                      {formatCurrency(line.net_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm font-semibold">
                <tr className="border-t border-black/10 dark:border-white/10">
                  <td className="p-2" colSpan={4}>
                    الإجمالي / الخصم / الصافي
                  </td>
                  <td className="p-2 text-end" dir="ltr">
                    {formatCurrency(invoice.grossTotal)} / {formatCurrency(invoice.discountTotal)} /{' '}
                    {formatCurrency(invoice.netTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-zinc-500">
        <Link to="/portal/invoices" className="underline">
          العودة إلى قائمة الفواتير
        </Link>
      </p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-32 shrink-0 text-zinc-500">{label}</span>
      <span>{children}</span>
    </div>
  )
}
