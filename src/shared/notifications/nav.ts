/**
 * Nav metadata for the notification centre. Dependency-light (no react /
 * appwrite / pages) so the app shell can import it without pulling the page
 * into the main bundle — the `/notifications` route chunk stays code-split.
 *
 * Every authenticated role gets notifications, so this item carries **no**
 * `roles` field. Confirmed against `src/presentation/layout/nav.ts`'s
 * `NavItem` type ("`roles` (when set) gates the item behind `RequireRole`")
 * and `AppLayout.tsx`'s `SidebarNav`, which renders an item with no `roles`
 * directly — `item.roles ? <RequireRole ...> : <NavItemLink ... />` — i.e. an
 * `undefined roles` item is always visible, exactly what's needed here.
 */
import type { NavItem } from '@/presentation/layout/nav'

export const notificationsNavItems: readonly NavItem[] = [
  {
    to: '/notifications',
    label: 'الإشعارات',
    labelEn: 'Notifications',
    end: true,
  },
]
