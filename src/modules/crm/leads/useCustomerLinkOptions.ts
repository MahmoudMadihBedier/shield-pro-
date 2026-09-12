/**
 * Customer picker for linking a "won" lead to the `customers` row created for
 * it. Derives from the shared `useCustomerDirectory` (single cached read,
 * shared with the hub's customer-name lookup) instead of fetching its own —
 * mapped through `useMemo` so callers keep the familiar `{ data, isLoading }`
 * query-result shape.
 */
import { useMemo } from 'react'

import { useCustomerDirectory } from '../useCustomerDirectory'

export function useCustomerLinkOptions() {
  const query = useCustomerDirectory()
  const data = useMemo(
    () => query.data?.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
    [query.data],
  )
  return { ...query, data }
}
