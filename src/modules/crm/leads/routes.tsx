/**
 * Route objects for the CRM leads pipeline. Spread under the staff
 * `AppLayout` route by the app shell, so paths are relative.
 */
import type { RouteObject } from 'react-router-dom'

import { LeadsListRoute } from './route-elements'

export const crmLeadsRoutes: RouteObject[] = [{ path: 'crm/leads', element: <LeadsListRoute /> }]
