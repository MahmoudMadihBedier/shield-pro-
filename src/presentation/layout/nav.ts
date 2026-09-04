import type { Role } from '@/core/rbac'
import { accountingNavItems } from '@/modules/accounting/presentation/nav'
import { adminNavItems } from '@/modules/admin/nav'
import { inventoryNavItems } from '@/modules/inventory/presentation/nav'
import { manufacturingNavItems } from '@/modules/manufacturing/presentation/nav'
import { purchasingNavItems } from '@/modules/purchasing/nav'
import { returnsNavItems } from '@/modules/returns/presentation/nav'
import { salesNavItems } from '@/modules/sales/presentation/nav'
import { traceabilityNavItems } from '@/modules/traceability/nav'

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

/** Primary nav — the dashboard plus each module's own entries. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'الرئيسية', labelEn: 'Home', end: true },
  ...traceabilityNavItems.map(
    (item): NavItem => ({
      to: item.to,
      label: item.labelAr,
      labelEn: item.labelEn,
      roles: item.roles,
      end: true,
    }),
  ),
  ...adminNavItems,
  ...purchasingNavItems,
  ...manufacturingNavItems,
  ...inventoryNavItems,
  ...accountingNavItems,
  ...salesNavItems,
  ...returnsNavItems,
]
