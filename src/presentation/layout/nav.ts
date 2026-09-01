import type { Role } from '@/core/rbac'

/**
 * A single primary-navigation entry. Modules append their own items here as
 * they land. `roles` (when set) gates the item behind `RequireRole` — a UX
 * affordance only; real enforcement is server-side (`claude.md` A.6).
 */
export interface NavItem {
  to: string
  /** Arabic-first label. */
  label: string
  /** English gloss. */
  labelEn: string
  /** If present, the item shows only when the principal holds one of these. */
  roles?: readonly Role[]
  /** Match the route exactly (passed to `NavLink`'s `end`). */
  end?: boolean
}

/** Primary nav. Only the dashboard route exists today (Phase 1). */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'الرئيسية', labelEn: 'Home', end: true },
]
