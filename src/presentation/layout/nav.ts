import type { Role } from '@/core/rbac'
import { accountingNavItems } from '@/modules/accounting/presentation/nav'
import { adminNavItems } from '@/modules/admin/nav'
import { inventoryNavItems } from '@/modules/inventory/presentation/nav'
import { approvalsNavItems } from '@/modules/approvals/presentation/nav'
import { hrNavItems } from '@/modules/hr/presentation/nav'
import { notificationsNavItems } from '@/shared/notifications/nav'
import { reportsNavItems } from '@/modules/reports/nav'
import { fraudNavItems } from '@/modules/fraud/nav'
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

/**
 * A top-nav group: its own landing route (`to`, the module hub) plus the
 * child routes. `items` empty ⇒ the group renders as a plain link; otherwise
 * as a dropdown whose panel lists the hub + `items`.
 */
export interface NavGroup extends NavItem {
  items: readonly NavItem[]
}

const traceabilityAsNavItems: readonly NavItem[] = traceabilityNavItems.map((item) => ({
  to: item.to,
  label: item.labelAr,
  labelEn: item.labelEn,
  roles: item.roles,
  end: true,
}))

/** `[head, ...children]` → one group. `head` is the module hub / landing link. */
function group(items: readonly NavItem[]): NavGroup {
  const [head, ...rest] = items
  if (!head) throw new Error('nav group needs at least one item')
  return { ...head, items: rest }
}

/** Primary nav as groups — the dashboard plus one group per module. */
export const NAV_GROUPS: readonly NavGroup[] = [
  { to: '/', label: 'الرئيسية', labelEn: 'Home', end: true, items: [] },
  group(traceabilityAsNavItems),
  group(adminNavItems),
  group(purchasingNavItems),
  group(manufacturingNavItems),
  group(inventoryNavItems),
  group(accountingNavItems),
  group(salesNavItems),
  group(returnsNavItems),
  group(fraudNavItems),
  group(approvalsNavItems),
  group(reportsNavItems),
  group(hrNavItems),
  group(notificationsNavItems),
]

/** Flat list of every nav entry (hubs + children) — kept for any consumer that
 *  wants the ungrouped view. */
export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((g) => [
  { to: g.to, label: g.label, labelEn: g.labelEn, roles: g.roles, end: g.end },
  ...g.items,
])
