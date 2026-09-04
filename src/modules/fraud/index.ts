/**
 * Public surface of the `fraud` module (Phase 2 Story 2.3) — the fraud-flags
 * dashboard fed by the `/fraud-scan` and `/review-fraud-flag` server routes.
 */

// --- pages ------------------------------------------------------------------
export { FraudFlagsPage } from './presentation/FraudFlagsPage'

// --- routing + nav -----------------------------------------------------------
export { fraudRoutes } from './routes'
export { fraudNavItems, FRAUD_NAV_ROLES } from './nav'
export { fraudKeys } from './query-keys'

// --- data (repository + Function wrappers) -----------------------------------
export {
  listFraudFlags,
  getFraudFlag,
  type FraudFlagListParams,
  type FraudFlagListPage,
} from './data/fraud-flags-repo'
export {
  runFraudScan,
  reviewFraudFlag,
  type FraudScanPayload,
  type FraudScanResult,
  type ReviewFraudFlagPayload,
  type ReviewFraudFlagResult,
} from './data/fraud-actions'

// --- domain (schemas, labels) -------------------------------------------------
export * from './domain/schemas'
export { FRAUD_KIND_LABELS, FRAUD_STATUS_LABELS, bilingual, type Label } from './domain/labels'
