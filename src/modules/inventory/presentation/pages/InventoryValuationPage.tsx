/**
 * Inventory valuation — Phase 4.2. Current stock value per (product, warehouse)
 * from the `inventory_valuation` RPC (bin balances × weighted-average unit cost
 * from the stock ledger), grouped by warehouse with subtotals + a grand total.
 * Printable + CSV/Excel export.
 */
import { useMemo } from 'react'

import { formatCurrency, formatNumber } from '@/shared/formatters'
import { ExportButton } from '@/shared/excel'
import { Card, PageHeader, PrintButton } from '@/shared/ui'
import { DocumentLetterhead } from '@/shared/documents'

import { groupByWarehouse, valuationToRows } from '../../domain/valuation'
import {
  optionLabelMap,
  useInventoryValuation,
  useProductOptions,
  useWarehouseOptions,
} from '../hooks'

export function InventoryValuationPage() {
  const query = useInventoryValuation()
  const warehouses = useWarehouseOptions()
  const products = useProductOptions()

  const warehouseLabel = useMemo(() => optionLabelMap(warehouses.data), [warehouses.data])
  const productLabel = useMemo(() => optionLabelMap(products.data), [products.data])
  const warehouseName = (id: string) => warehouseLabel.get(id) ?? id
  const productName = (id: string) => productLabel.get(id) ?? id

  const report = query.data
  const groups = useMemo(() => (report ? groupByWarehouse(report.rows) : []), [report])

  const exportRows = useMemo(() => {
    if (!report) return []
    return valuationToRows(report, {
      warehouse: (id) => warehouseLabel.get(id) ?? id,
      product: (id) => productLabel.get(id) ?? id,
    }).map((r) => ({
      ...r,
      qty: round2(r.qty),
      unit_cost: round2(r.unit_cost),
      value: round2(r.value),
    }))
  }, [report, warehouseLabel, productLabel])

  return (
    <div className="space-y-4">
      <DocumentLetterhead reference="تقييم المخزون / Inventory valuation" />
      <PageHeader
        title="تقييم المخزون"
        titleEn="Inventory valuation"
        description="قيمة المخزون الحالي = الرصيد × متوسط تكلفة الوحدة من دفتر المخزون."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              fileName="inventory-valuation"
              rows={exportRows}
              columns={[
                { key: 'warehouse', header: 'Warehouse' },
                { key: 'product', header: 'Product' },
                { key: 'qty', header: 'Qty' },
                { key: 'unit_cost', header: 'Unit cost' },
                { key: 'value', header: 'Value' },
              ]}
              disabled={!report || report.rows.length === 0}
            />
            <PrintButton documentTitle="تقييم المخزون" />
          </div>
        }
      />

      {query.isLoading ? (
        <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card>
      ) : query.isError ? (
        <Card className="flex flex-col items-start gap-2 text-sm text-red-600 dark:text-red-400">
          {query.error.message}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </button>
        </Card>
      ) : !report || report.rows.length === 0 ? (
        <Card className="text-sm text-zinc-500">لا يوجد رصيد مخزون قابل للتقييم.</Card>
      ) : (
        <>
          <Card className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm text-zinc-500">
              إجمالي قيمة المخزون / Total inventory value ({formatNumber(report.lineCount)} بند)
            </span>
            <span className="text-lg font-bold tabular-nums" dir="ltr">
              {formatCurrency(report.totalValue)}
            </span>
          </Card>

          {groups.map((group) => (
            <Card key={group.warehouseId} className="p-0">
              <div className="flex items-center justify-between border-b border-black/10 px-3 py-2 text-sm font-semibold dark:border-white/10">
                <span>{warehouseName(group.warehouseId)}</span>
                <span className="tabular-nums" dir="ltr">
                  {formatCurrency(group.subtotal)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-black/[0.02] text-xs text-zinc-500 dark:bg-white/[0.03]">
                    <tr>
                      <th className="p-2 text-start">الصنف / Product</th>
                      <th className="p-2 text-end">الرصيد / Qty</th>
                      <th className="p-2 text-end">تكلفة الوحدة / Unit cost</th>
                      <th className="p-2 text-end">القيمة / Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr
                        key={`${row.warehouseId}-${row.productId}`}
                        className="border-t border-black/5 dark:border-white/5"
                      >
                        <td className="p-2">{productName(row.productId)}</td>
                        <td className="p-2 text-end tabular-nums" dir="ltr">
                          {formatNumber(row.qty)}
                        </td>
                        <td className="p-2 text-end tabular-nums" dir="ltr">
                          {row.unitCost ? formatCurrency(row.unitCost) : '—'}
                        </td>
                        <td className="p-2 text-end tabular-nums" dir="ltr">
                          {formatCurrency(row.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </>
      )}
    </div>
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
