/**
 * Admin dashboard — Phase 4 Story 4.4. KPI row, two charts, branch/rep
 * performance tables (each with its own CSV export) and the SLA-breach /
 * reorder-alert lists. One `useDashboard` call drives the whole page; loading
 * / empty / error states are explicit (`claude.md` A.3).
 */
import { formatCurrency, formatNumber, formatPercent } from '@/shared/formatters'
import { Card, PageHeader } from '@/shared/ui'

import {
  BranchRepPerformanceTable,
  ExportCsvButton,
  KpiCard,
  MonthlySalesTrendChart,
  ReorderAlertList,
  SlaBreachList,
  TopProductsChart,
} from '../components'
import { useDashboard } from '../hooks/useDashboard'

const SLA_HOURS = 24

export function DashboardPage() {
  const { view, isLoading, isError, error, refetch } = useDashboard({ slaHours: SLA_HOURS })

  return (
    <div className="space-y-4">
      <PageHeader
        title="لوحة التحكم"
        titleEn="Dashboard"
        description="أداء المبيعات والمخزون من الدفاتر الحيّة — بدون تجميع مخزّن مسبقًا."
      />

      {isError ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error?.message ?? 'تعذّر تحميل لوحة التحكم.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            إعادة المحاولة
          </button>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="صافي مبيعات الشهر"
              labelEn="Net revenue (this month)"
              value={formatCurrency(view?.totalNetRevenueThisMonth ?? 0)}
              isLoading={isLoading}
              trend={view?.monthlyTrend.map((m) => m.netRevenue)}
            />
            <KpiCard
              label="هامش الربح الإجمالي (تقديري)"
              labelEn="Gross margin (proxy)"
              value={formatPercent(view?.grossMarginRatio ?? 0)}
              isLoading={isLoading}
            />
            <KpiCard
              label="طلبات تجاوزت مهلة الاعتماد"
              labelEn="Open SLA breaches"
              value={formatNumber(view?.slaBreaches.length ?? 0)}
              isLoading={isLoading}
            />
            <KpiCard
              label="تنبيهات إعادة الطلب"
              labelEn="Reorder alerts"
              value={formatNumber(view?.reorderAlerts.length ?? 0)}
              isLoading={isLoading}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <MonthlySalesTrendChart
                title="اتجاه المبيعات الشهري"
                titleEn="Monthly sales trend"
                rows={view?.monthlyTrend ?? []}
                emptyMessage="لا توجد بيانات مبيعات بعد"
              />
            </Card>
            <Card>
              <TopProductsChart
                title="الأكثر مبيعًا"
                titleEn="Top products"
                rows={view?.topProducts ?? []}
                productLabel={view?.productLabel ?? new Map()}
                emptyMessage="لا توجد فواتير معتمدة بعد"
              />
            </Card>
          </div>

          <Card>
            <TopProductsChart
              title="الأقل مبيعًا"
              titleEn="Bottom products"
              rows={view?.bottomProducts ?? []}
              productLabel={view?.productLabel ?? new Map()}
              emptyMessage="لا توجد أصناف ذات مبيعات منخفضة"
            />
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">أداء الفروع / Branch performance</h3>
                <ExportCsvButton
                  fileName="branch-performance"
                  rows={(view?.branchPerformance ?? []).map((r) => ({
                    branch: r.name,
                    net_revenue: r.netRevenue,
                    invoice_count: r.invoiceCount,
                  }))}
                  columns={[
                    { key: 'branch', header: 'Branch' },
                    { key: 'net_revenue', header: 'Net revenue' },
                    { key: 'invoice_count', header: 'Invoices' },
                  ]}
                />
              </div>
              <BranchRepPerformanceTable
                rows={view?.branchPerformance ?? []}
                nameHeader="الفرع / Branch"
                emptyMessage="لا توجد بيانات فروع"
                isLoading={isLoading}
              />
            </Card>

            <Card className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">أداء المناديب / Rep performance</h3>
                <ExportCsvButton
                  fileName="rep-performance"
                  rows={(view?.repPerformance ?? []).map((r) => ({
                    rep: r.name,
                    net_revenue: r.netRevenue,
                    invoice_count: r.invoiceCount,
                  }))}
                  columns={[
                    { key: 'rep', header: 'Rep' },
                    { key: 'net_revenue', header: 'Net revenue' },
                    { key: 'invoice_count', header: 'Invoices' },
                  ]}
                />
              </div>
              <BranchRepPerformanceTable
                rows={view?.repPerformance ?? []}
                nameHeader="المندوب / Rep"
                emptyMessage="لا توجد بيانات مناديب"
                isLoading={isLoading}
              />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">
                  طلبات تجاوزت مهلة الاعتماد ({SLA_HOURS} ساعة) / SLA breaches
                </h3>
                <ExportCsvButton
                  fileName="sla-breaches"
                  rows={(view?.slaBreaches ?? []).map((b) => ({
                    entity_ref: b.entityRef,
                    age_hours: Math.round(b.ageHours * 10) / 10,
                  }))}
                  columns={[
                    { key: 'entity_ref', header: 'Entity' },
                    { key: 'age_hours', header: 'Age (hours)' },
                  ]}
                />
              </div>
              {isLoading ? (
                <p className="py-6 text-center text-sm text-zinc-500">جارٍ التحميل…</p>
              ) : (
                <SlaBreachList
                  rows={view?.slaBreaches ?? []}
                  slaHours={SLA_HOURS}
                  emptyMessage="لا توجد طلبات متجاوزة لمهلة الاعتماد"
                />
              )}
            </Card>

            <Card className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">تنبيهات إعادة الطلب / Reorder alerts</h3>
                <ExportCsvButton
                  fileName="reorder-alerts"
                  rows={(view?.reorderAlerts ?? []).map((a) => ({
                    material: view?.materialLabel.get(a.rawMaterialId) ?? a.rawMaterialId,
                    on_hand: a.onHand,
                    reorder_point: a.reorderPoint,
                    shortfall: a.shortfall,
                  }))}
                  columns={[
                    { key: 'material', header: 'Raw material' },
                    { key: 'on_hand', header: 'On hand' },
                    { key: 'reorder_point', header: 'Reorder point' },
                    { key: 'shortfall', header: 'Shortfall' },
                  ]}
                />
              </div>
              {isLoading ? (
                <p className="py-6 text-center text-sm text-zinc-500">جارٍ التحميل…</p>
              ) : (
                <ReorderAlertList
                  rows={view?.reorderAlerts ?? []}
                  materialLabel={view?.materialLabel ?? new Map()}
                  emptyMessage="لا توجد تنبيهات إعادة طلب"
                />
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
