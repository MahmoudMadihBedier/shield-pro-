/**
 * Load a small option list for a `relation` form field (branch / supplier /
 * raw-material pickers). Capped at 100 rows — these are master tables, not
 * transaction volume.
 */
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'

import { ADMIN_REGISTRY } from '../registry'
import type { FieldDescriptor } from '../registry'

export interface RelationOption {
  value: string
  label: string
}

type RelationTo = NonNullable<FieldDescriptor['relationTo']>

const RELATION_ENTITY = {
  branch: 'branch',
  supplier: 'supplier',
  rawMaterial: 'rawMaterial',
} as const

export function useRelationOptions(relationTo: RelationTo | undefined) {
  return useQuery<RelationOption[], AppError>({
    queryKey: queryKeys.admin.list(`relation:${relationTo ?? 'none'}`, 'options'),
    enabled: relationTo != null,
    staleTime: 60_000,
    queryFn: async () => {
      const entity = RELATION_ENTITY[relationTo as RelationTo]
      const result = await ADMIN_REGISTRY[entity].repo.list({
        page: 0,
        pageSize: 100,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!result.ok) throw result.error
      return result.value.rows.map((row) => {
        const record = row as { $id: string; name?: string; full_name?: string; code?: string }
        const label = record.name ?? record.full_name ?? record.code ?? record.$id
        return { value: record.$id, label: `${label} · ${record.$id.slice(0, 6)}` }
      })
    },
  })
}
