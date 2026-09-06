/**
 * Nav metadata for the `admin` module. Kept in a dedicated, dependency-light
 * file (no react / appwrite / pages) so the app shell can import it without
 * pulling the whole module into the main bundle — the `/admin/*` route chunks
 * stay code-split.
 */
import { Role } from '@/core/rbac'
import type { NavItem } from '@/presentation/layout/nav'

import { ENTITY_LABELS, type AdminEntity } from './domain/labels'

/** Entities that get a top-level list route/page (`product_bom` is nested). */
export const ADMIN_LIST_ENTITIES = [
  'branch',
  'warehouse',
  'user',
  'product',
  'rawMaterial',
  'supplier',
  'customer',
] as const satisfies ReadonlyArray<AdminEntity>

export type AdminListEntity = (typeof ADMIN_LIST_ENTITIES)[number]

/** URL slug per entity (router + nav + home page share this). */
export const ADMIN_ENTITY_SLUG: Record<AdminListEntity, string> = {
  branch: 'branches',
  warehouse: 'warehouses',
  user: 'users',
  product: 'products',
  rawMaterial: 'raw-materials',
  supplier: 'suppliers',
  customer: 'customers',
}

const ADMIN_ROLES = [Role.SystemAdmin] as const

/**
 * Nav entries for the app shell. The section is System-Admin-oriented — every
 * item is gated to `Role.SystemAdmin` (master data + branch binding are
 * admin-only per `IMPLEMENTATION_PLAN.md` §4.6).
 */
export const adminNavItems: readonly NavItem[] = [
  { to: '/admin', label: 'الإدارة', labelEn: 'Admin', roles: ADMIN_ROLES, end: true },
  ...ADMIN_LIST_ENTITIES.map(
    (entity): NavItem => ({
      to: `/admin/${ADMIN_ENTITY_SLUG[entity]}`,
      label: ENTITY_LABELS[entity].many.ar,
      labelEn: ENTITY_LABELS[entity].many.en,
      roles: ADMIN_ROLES,
    }),
  ),
  { to: '/admin/import', label: 'استيراد البيانات', labelEn: 'Data import', roles: ADMIN_ROLES },
]
