/**
 * Route objects for the `purchasing` module. The app shell spreads
 * `purchasingRoutes` under its authenticated `AppLayout` route, so paths are
 * relative (no leading slash) and each element is a lazy page component (see
 * `./presentation/route-elements`).
 */
import type { RouteObject } from 'react-router-dom'

import {
  PurchaseOrderDetailRoute,
  PurchaseOrderListRoute,
  PurchasingHomeRoute,
  StockReceiptDetailRoute,
  StockReceiptListRoute,
} from './presentation/route-elements'

export const purchasingRoutes: RouteObject[] = [
  { path: 'purchasing', element: <PurchasingHomeRoute /> },
  { path: 'purchasing/orders', element: <PurchaseOrderListRoute /> },
  { path: 'purchasing/orders/:id', element: <PurchaseOrderDetailRoute /> },
  { path: 'purchasing/receipts', element: <StockReceiptListRoute /> },
  { path: 'purchasing/receipts/:id', element: <StockReceiptDetailRoute /> },
]
