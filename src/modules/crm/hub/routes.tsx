/**
 * Route objects for the CRM hub. Spread under the staff `AppLayout` route by
 * the app shell, so paths are relative.
 */
import type { RouteObject } from 'react-router-dom'

import { CrmHomeRoute } from './route-elements'

export const crmHubRoutes: RouteObject[] = [{ path: 'crm', element: <CrmHomeRoute /> }]
