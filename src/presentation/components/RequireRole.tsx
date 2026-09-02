import type { ReactNode } from 'react'

import { useAuth } from '@/application/auth/context'
import { hasRole, type Role } from '@/core/rbac'

/**
 * Hide a subtree unless the current principal holds one of `anyOf`. This is a UX
 * affordance only — server-side Functions + collection permissions are the real
 * gate (claude.md A.6).
 */
export function RequireRole({
  anyOf,
  children,
  fallback = null,
}: {
  anyOf: readonly Role[]
  children: ReactNode
  fallback?: ReactNode
}) {
  const { principal } = useAuth()
  const allowed = principal != null && anyOf.some((role) => hasRole(principal, role))
  return <>{allowed ? children : fallback}</>
}
