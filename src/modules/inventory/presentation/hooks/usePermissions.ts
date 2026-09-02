/**
 * UI-level RBAC affordances for the inventory module. These only decide what to
 * show / enable — real enforcement is server-side in Functions + collection
 * permissions (`claude.md` A.6).
 */
import { useMemo } from 'react'

import { useAuth } from '@/application/auth/context'
import { Role, hasRole, type Principal } from '@/core/rbac'

const WAREHOUSE_MANAGER_ROLES: readonly Role[] = [
  Role.MainWarehouseManager,
  Role.SubWarehouseManager,
  Role.SystemAdmin,
]

function anyRole(principal: Principal | null, roles: readonly Role[]): boolean {
  return principal != null && roles.some((role) => hasRole(principal, role))
}

export interface InventoryPermissions {
  principal: Principal | null
  isAdmin: boolean
  /** Create a transfer / write-off Draft, open a count session. */
  canRequest: boolean
  /** Approve or reject a pending transfer. */
  canApproveTransfer: boolean
  /** Mark an approved transfer as sent (source keeper). */
  canSendTransfer: boolean
  /** Confirm receipt of a sent transfer (destination keeper). */
  canReceiveTransfer: boolean
  /** Sign off a submitted stock-count session. */
  canSignOffCount: boolean
}

export function useInventoryPermissions(): InventoryPermissions {
  const { principal } = useAuth()

  return useMemo(() => {
    const isAdmin = anyRole(principal, [Role.SystemAdmin])
    const isWarehouseManager = anyRole(principal, WAREHOUSE_MANAGER_ROLES)
    return {
      principal,
      isAdmin,
      canRequest: isWarehouseManager,
      canApproveTransfer: isWarehouseManager,
      canSendTransfer: isWarehouseManager,
      canReceiveTransfer: isWarehouseManager,
      canSignOffCount: isAdmin,
    }
  }, [principal])
}
