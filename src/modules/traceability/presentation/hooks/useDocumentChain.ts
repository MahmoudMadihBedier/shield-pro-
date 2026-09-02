import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'
import { isReferenceId } from '@/core/reference-id'

import { resolveNode } from '../../data/traceability-repo'
import { walkChain, type ChainGraph, type ChainNode } from '../../domain/chain-walker'

/** Unwrap the repo `Result` so React Query sees a thrown `AppError` on failure. */
async function resolve(refId: string): Promise<ChainNode | null> {
  const result = await resolveNode(refId)
  if (!result.ok) throw result.error
  return result.value
}

/**
 * Walk the full traceability graph around `rootRefId` (both directions,
 * bounded). Disabled until a syntactically valid reference id is supplied.
 */
export function useDocumentChain(rootRefId: string | null) {
  const normalized = rootRefId?.trim() ?? ''
  return useQuery<ChainGraph, AppError>({
    queryKey: queryKeys.traceability.chain(normalized),
    enabled: normalized.length > 0 && isReferenceId(normalized),
    queryFn: () => walkChain(normalized, resolve),
  })
}
