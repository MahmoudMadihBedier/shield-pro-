/**
 * Public surface of the `reports` module (Phase 4 Story 4.4 — admin dashboard
 * + a lightweight CSV-export slice of 4.1/4.2).
 */
// --- pages ----------------------------------------------------------------
export { DashboardPage } from './presentation/pages/DashboardPage'

// --- routing + nav ----------------------------------------------------
export { reportsRoutes } from './routes'
export { reportsNavItems, REPORTS_NAV_ROLES } from './nav'

// --- domain (pure aggregation functions + types) -----------------------
export {
  topProducts,
  bottomProducts,
  branchPerformance,
  repPerformance,
  grossMargin,
  monthlySalesTrend,
  type TopProduct,
  type BranchPerformance,
  type RepPerformance,
  type MonthlyRevenue,
  type InvoiceLineLike,
} from './domain/sales-performance'
export { slaBreaches, type SlaBreach, type PendingApprovalLike } from './domain/approvals-sla'
export { reorderAlerts, type ReorderAlert, type RawMaterialLike } from './domain/reorder-alerts'
export { toCsv, type CsvColumn } from './domain/csv'

// --- data (read repository) ---------------------------------------------
export {
  fetchDashboardData,
  type DashboardData,
  type DashboardInvoiceRow,
  type FetchDashboardDataParams,
} from './data/dashboard-repo'

// --- presentation hooks/components (for potential composition elsewhere) --
export { useDashboard, type UseDashboardParams, type DashboardView } from './presentation/hooks'
