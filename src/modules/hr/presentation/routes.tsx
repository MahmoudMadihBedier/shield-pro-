/**
 * Route objects for the `hr` module. The app shell spreads `hrRoutes` under
 * its authenticated `AppLayout` route, so paths are relative (no leading
 * slash) and each element is a lazy page component (see `./route-elements`).
 */
import type { RouteObject } from 'react-router-dom'

import {
  AttendanceListRoute,
  AttendanceSheetRoute,
  HrHubRoute,
  IncentiveRulesListRoute,
  PayrollRunDetailRoute,
  PayrollRunFormRoute,
  PayrollRunListRoute,
} from './route-elements'

export const hrRoutes: RouteObject[] = [
  { path: 'hr', element: <HrHubRoute /> },
  { path: 'hr/attendance', element: <AttendanceListRoute /> },
  { path: 'hr/attendance/sheet', element: <AttendanceSheetRoute /> },
  { path: 'hr/incentive-rules', element: <IncentiveRulesListRoute /> },
  { path: 'hr/payroll', element: <PayrollRunListRoute /> },
  { path: 'hr/payroll/new', element: <PayrollRunFormRoute /> },
  { path: 'hr/payroll/:id', element: <PayrollRunDetailRoute /> },
]
