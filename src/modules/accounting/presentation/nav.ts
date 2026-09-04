/**
 * Nav metadata for the `accounting` module. Dependency-light (no react / data
 * layer) so the app shell can import it without pulling the module into the
 * main bundle — the `/accounting/*` route chunks stay code-split.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

export const ACCOUNTING_NAV_ROLES: readonly Role[] = [
  Role.BranchAccountant,
  Role.ChiefAccountant,
  Role.MainWarehouseAccountant,
  Role.SystemAdmin,
]

export const accountingNavItems: NavItem[] = [
  {
    to: '/accounting',
    label: 'المحاسبة',
    labelEn: 'Accounting',
    roles: ACCOUNTING_NAV_ROLES,
    end: true,
  },
  {
    to: '/accounting/receipts',
    label: 'التحصيلات',
    labelEn: 'Collections',
    roles: ACCOUNTING_NAV_ROLES,
  },
  {
    to: '/accounting/vouchers',
    label: 'سندات الصرف والقبض',
    labelEn: 'Vouchers',
    roles: ACCOUNTING_NAV_ROLES,
  },
  {
    to: '/accounting/aging',
    label: 'أعمار الديون',
    labelEn: 'Customer aging',
    roles: ACCOUNTING_NAV_ROLES,
  },
  {
    to: '/accounting/trial-balance',
    label: 'ميزان المراجعة',
    labelEn: 'Trial balance',
    roles: ACCOUNTING_NAV_ROLES,
  },
  {
    to: '/accounting/ledger',
    label: 'دفتر الأستاذ',
    labelEn: 'General ledger',
    roles: ACCOUNTING_NAV_ROLES,
  },
]
