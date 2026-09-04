/**
 * UI-level RBAC affordances for the returns module. These only decide what to
 * show / enable — real enforcement is server-side in Functions + collection
 * permissions (`claude.md` A.6). Roles mirror
 * `src/core/access.ts::SUBMIT_ROLE_BY_TABLE['return_requests']`.
 */
import { useMemo } from 'react'

import { useAuth } from '@/application/auth/context'
import { Role, hasRole, type Principal } from '@/core/rbac'

/** `SUBMIT_ROLE_BY_TABLE['return_requests']` — approve/reject/submit/cancel a return. */
export const RETURNS_MANAGER_ROLES: readonly Role[] = [Role.BranchAccountant, Role.SystemAdmin]

function anyRole(principal: Principal | null, roles: readonly Role[]): boolean {
  return principal != null && roles.some((role) => hasRole(principal, role))
}

export interface ReturnsPermissions {
  principal: Principal | null
  /** Create a return-request Draft. */
  canRequest: boolean
  /** Approve / reject a pending return. */
  canApprove: boolean
  /** Submit an approved Draft, or cancel a Submitted return. */
  canSubmitOrCancel: boolean
  /** Post the ledger movement once submitted. */
  canPost: boolean
}

export function useReturnsPermissions(): ReturnsPermissions {
  const { principal } = useAuth()

  return useMemo(() => {
    const isManager = anyRole(principal, RETURNS_MANAGER_ROLES)
    return {
      principal,
      canRequest: isManager,
      canApprove: isManager,
      canSubmitOrCancel: isManager,
      canPost: isManager,
    }
  }, [principal])
}
