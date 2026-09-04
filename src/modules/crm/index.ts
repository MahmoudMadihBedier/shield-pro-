/**
 * Public surface of the `crm` module (Phase 3 — client portal).
 *
 * Two halves live here for locality:
 *  - `portal/*`  — the customer-facing client portal (its own auth, its own
 *    layout, top-level absolute routes — NOT nested under the staff `AppLayout`).
 *  - `admin/*`   — the staff-facing panel that creates/resets/revokes a
 *    customer's portal account.
 */

// --- portal (customer-facing) ----------------------------------------------
export { portalRoutes } from './portal/routes'
export { PortalAuthProvider } from './portal/auth/PortalAuthProvider'
export { usePortalAuth, type PortalAuthContextValue, type PortalCustomer } from './portal/auth/portal-context'
export { RequirePortalAuth } from './portal/components/RequirePortalAuth'

// --- admin (staff-facing) ---------------------------------------------------
export { PortalAccountPanel, type PortalAccountPanelProps, type PortalLinkedCustomer } from './admin/PortalAccountPanel'
export { useCreatePortalAccount, useResetPortalPin, useRevokePortalAccess } from './admin/hooks'

// --- domain types ------------------------------------------------------------
export { portalKeys, crmAdminKeys } from './query-keys'
