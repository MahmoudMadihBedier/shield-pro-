/**
 * Public surface of the `hr` module — attendance, incentive rules and
 * payroll runs.
 *
 * Domain schemas / types here are the source of truth for these row shapes
 * (`claude.md` B.2). Admin master-data (`User`, `Branch`) is imported from
 * `@/modules/admin`, never re-declared.
 */

// --- pages ------------------------------------------------------------------
export {
  HrHubPage,
  AttendanceListPage,
  AttendanceSheetPage,
  IncentiveRulesListPage,
  PayrollRunListPage,
  PayrollRunFormPage,
  PayrollRunDetailPage,
} from './presentation/pages'

// --- routing + nav -----------------------------------------------------------
export { hrRoutes } from './presentation/routes'
export { hrNavItems } from './presentation/nav'

// --- data (repositories) ------------------------------------------------------
export { upsertAttendance, listAttendance } from './data/attendance-repo'
export type {
  UpsertAttendanceInput,
  AttendanceListParams,
  AttendanceListPage as AttendanceRecordsPage,
} from './data/attendance-repo'
export { incentiveRulesRepo } from './data/incentive-rules-repo'
export { payrollRunsRepo } from './data/payroll-repo'
export type { PayrollRunWriteFields } from './data/payroll-repo'
export { listEmployees, employeeRowSchema } from './data/employees-repo'
export type { Employee, EmployeeListParams, EmployeeListPage } from './data/employees-repo'

// --- domain (schemas, pure business logic) -----------------------------------
export * from './domain/schemas'
export {
  computeNetPay,
  buildPayrollLines,
  payrollTotal,
  serializePayrollLines,
  parsePayrollLines,
  type PayrollEmployeeInput,
} from './domain/payroll'
export {
  evaluateIncentive,
  parseIncentivePredicate,
  serializeIncentivePredicate,
  incentivePredicateSchema,
  type IncentivePredicate,
  type IncentiveFacts,
  type IncentiveRuleLike,
} from './domain/incentives'
export { isWorkingDay, monthlyAttendanceSummary, type AttendanceSummary } from './domain/attendance'
