/**
 * Route objects for the `manufacturing` module. The app shell splices
 * `manufacturingRoutes` into the authenticated layout's `children` — this file
 * does NOT edit `src/app/router.tsx`.
 *
 * Paths are relative (no leading slash) so they nest under the `/` layout
 * route. Pages are `React.lazy` + wrapped in a local `<Boundary>` Suspense (see
 * `./route-lazy`) so the chunks stay split without depending on the router's
 * own boundary.
 *
 * Spine: `/manufacturing` (hub), `/manufacturing/requests`,
 * `/manufacturing/requests/:id`, `/manufacturing/batches`,
 * `/manufacturing/batches/:id`. The `requests/new` and `batches/new` children
 * carry the create forms (a static segment out-ranks `:id` in React Router v7).
 */
import type { RouteObject } from 'react-router-dom'

import {
  Boundary,
  ManufacturingHubPage,
  ProductionBatchDetailPage,
  ProductionBatchFormPage,
  ProductionBatchListPage,
  ProductionRequestDetailPage,
  ProductionRequestFormPage,
  ProductionRequestListPage,
} from './route-lazy'

export const manufacturingRoutes: RouteObject[] = [
  { path: 'manufacturing', element: <Boundary><ManufacturingHubPage /></Boundary> },
  { path: 'manufacturing/requests', element: <Boundary><ProductionRequestListPage /></Boundary> },
  { path: 'manufacturing/requests/new', element: <Boundary><ProductionRequestFormPage /></Boundary> },
  { path: 'manufacturing/requests/:id', element: <Boundary><ProductionRequestDetailPage /></Boundary> },
  { path: 'manufacturing/batches', element: <Boundary><ProductionBatchListPage /></Boundary> },
  { path: 'manufacturing/batches/new', element: <Boundary><ProductionBatchFormPage /></Boundary> },
  { path: 'manufacturing/batches/:id', element: <Boundary><ProductionBatchDetailPage /></Boundary> },
]
