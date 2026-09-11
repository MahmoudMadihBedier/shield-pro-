/**
 * Public surface of the `crm` module.
 *
 * Two halves live here for locality:
 *  - `portal/*`  — the customer-facing client portal (its own auth, its own
 *    layout, top-level absolute routes — NOT nested under the staff `AppLayout`).
 *  - `admin/*`   — the staff-facing pieces mounted on the customer detail page:
 *    the portal-account panel and the customer activity log.
 */

// --- portal (customer-facing) ----------------------------------------------
export { portalRoutes } from './portal/routes'
export { PortalAuthProvider } from './portal/auth/PortalAuthProvider'
export {
  usePortalAuth,
  type PortalAuthContextValue,
  type PortalCustomer,
} from './portal/auth/portal-context'
export { RequirePortalAuth } from './portal/components/RequirePortalAuth'

// --- admin (staff-facing) -------------------------------------------------
// NB: `AppProviders` imports `PortalAuthProvider` from this barrel, so keep it
// light — the staff-side panels (`PortalAccountPanel`, `CustomerActivityLog`)
// and their form kit are imported from their leaf paths by the pages that
// mount them, NOT re-exported here, or they land in the eager bundle.
export { useCreatePortalAccount, useResetPortalPin, useRevokePortalAccess } from './admin/hooks'

// --- domain (pure, framework-free) --------------------------------------
export {
  ACTIVITY_KINDS,
  ACTIVITY_OUTCOMES,
  activityKindLabel,
  activityOutcomeLabel,
  sortActivities,
  countByKind,
  type ActivityKind,
  type ActivityRow,
} from './domain/activity'
export {
  FOLLOWUP_STATUSES,
  followupStatusLabel,
  isOverdue,
  sortFollowups,
  countOverdue,
  type FollowupStatus,
  type FollowupRow,
} from './domain/followup'
export { portalKeys, crmAdminKeys } from './query-keys'
