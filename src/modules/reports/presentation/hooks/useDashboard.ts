/**
 * `useDashboard` — fetches `DashboardData` and runs every domain aggregation
 * on it (`useMemo`'d), returning one shaped object `DashboardPage` consumes.
 * The only TanStack Query call in this module (`claude.md` B.1: server data
 * never lives in local state).
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import { slaBreaches, type SlaBreach } from '../../domain/approvals-sla'
import { reorderAlerts, type ReorderAlert } from '../../domain/reorder-alerts'
import {
  branchPerformance,
  bottomProducts,
  grossMargin,
  monthlySalesTrend,
  repPerformance,
  topProducts,
  type MonthlyRevenue,
  type TopProduct,
} from '../../domain/sales-performance'
import { fetchDashboardData, type DashboardData } from '../../data/dashboard-repo'
import type { PerformanceRow } from '../components'
import { reportsKeys } from '../query-keys'

/** Mirrors `dashboard-repo.ts`'s `DEFAULT_MONTHS`. */
const DEFAULT_MONTHS = 6
/** Mirrors `approvals-sla.ts`'s default SLA window. */
const DEFAULT_SLA_HOURS = 24

const UNASSIGNED_BRANCH_LABEL = 'غير محدد / Unassigned'

export interface UseDashboardParams {
  months?: number
  slaHours?: number
}

export interface DashboardView {
  topProducts: TopProduct[]
  bottomProducts: TopProduct[]
  branchPerformance: PerformanceRow[]
  repPerformance: PerformanceRow[]
  monthlyTrend: MonthlyRevenue[]
  totalNetRevenueThisMonth: number
  grossMarginRatio: number
  slaBreaches: SlaBreach[]
  reorderAlerts: ReorderAlert[]
  /** `productId -> display name`, for the top/bottom-products chart. */
  productLabel: Map<string, string>
  /** `rawMaterialId -> "code — name"`, for the reorder-alert list. */
  materialLabel: Map<string, string>
}

function buildView(data: DashboardData, months: number, slaHours: number): DashboardView {
  const allLines = data.invoices.flatMap((inv) => inv.lines)

  const branchNameMap = new Map(data.branches.map((b) => [b.$id, b.name_ar || b.name]))
  const branches: PerformanceRow[] = branchPerformance(data.invoices).map((r) => ({
    id: r.branchId,
    name: r.branchId === 'unassigned' ? UNASSIGNED_BRANCH_LABEL : (branchNameMap.get(r.branchId) ?? r.branchId),
    netRevenue: r.netRevenue,
    invoiceCount: r.invoiceCount,
  }))

  const userNameMap = new Map(data.users.map((u) => [u.$id, u.full_name]))
  const reps: PerformanceRow[] = repPerformance(data.invoices).map((r) => ({
    id: r.repUserId,
    name: userNameMap.get(r.repUserId) ?? r.repUserId,
    netRevenue: r.netRevenue,
    invoiceCount: r.invoiceCount,
  }))

  const productLabel = new Map(data.products.map((p) => [p.$id, p.name_ar || p.name]))
  const basePriceByProduct = new Map(data.products.map((p) => [p.$id, p.base_price]))

  const netRevenue = data.invoices.reduce((sum, inv) => sum + inv.net_total, 0)
  // COGS proxy: qty × the product's admin-set base price (never the true
  // moving valuation rate — see `sales-performance.ts#grossMargin` doc).
  const cogsProxy = allLines.reduce(
    (sum, line) => sum + line.qty * (basePriceByProduct.get(line.product_id) ?? 0),
    0,
  )

  const monthlyTrend = monthlySalesTrend(data.invoices, months)

  const materialLabel = new Map(data.rawMaterials.map((m) => [m.$id, `${m.code} — ${m.name}`]))

  return {
    topProducts: topProducts(allLines),
    bottomProducts: bottomProducts(allLines),
    branchPerformance: branches,
    repPerformance: reps,
    monthlyTrend,
    totalNetRevenueThisMonth: monthlyTrend[monthlyTrend.length - 1]?.netRevenue ?? 0,
    grossMarginRatio: grossMargin(netRevenue, cogsProxy),
    slaBreaches: slaBreaches(data.pendingApprovals, slaHours),
    reorderAlerts: reorderAlerts(data.rawMaterials, data.onHandByMaterial),
    productLabel,
    materialLabel,
  }
}

export function useDashboard(params: UseDashboardParams = {}) {
  const months = params.months ?? DEFAULT_MONTHS
  const slaHours = params.slaHours ?? DEFAULT_SLA_HOURS

  const query = useQuery<DashboardData, AppError>({
    queryKey: reportsKeys.dashboard({ months, slaHours }),
    queryFn: async () => {
      const res = await fetchDashboardData({ months, slaHours })
      if (!res.ok) throw res.error
      return res.value
    },
  })

  const view = useMemo(
    () => (query.data ? buildView(query.data, months, slaHours) : null),
    [query.data, months, slaHours],
  )

  return {
    view,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.isError ? query.error : null,
    refetch: () => void query.refetch(),
  }
}
