/**
 * UI-level RBAC affordances for the accounting module. These only decide what
 * to show / enable — real enforcement is server-side in Functions + collection
 * permissions (`claude.md` A.6).
 */
import { useMemo } from 'react'

import { useAuth } from '@/application/auth/context'
import { Role, hasRole, type Principal } from '@/core/rbac'

/** Roles that may work in the accounting section. */
export const ACCOUNTING_ROLES: readonly Role[] = [
  Role.BranchAccountant,
  Role.ChiefAccountant,
  Role.MainWarehouseAccountant,
  Role.SystemAdmin,
]

function anyRole(principal: Principal | null, roles: readonly Role[]): boolean {
  return principal != null && roles.some((role) => hasRole(principal, role))
}

export interface AccountingPermissions {
  principal: Principal | null
  isAdmin: boolean
  /** See any accounting screen. */
  canView: boolean
  /** Create a receipt / payment-voucher Draft. */
  canRecord: boolean
  /** Submit a Draft (Draft → Submitted). */
  canSubmit: boolean
  /** Cancel a Submitted document. */
  canCancel: boolean
  /** Post a submitted document into the general ledger. */
  canPostGl: boolean
}

export function useAccountingPermissions(): AccountingPermissions {
  const { principal } = useAuth()

  return useMemo(() => {
    const isAdmin = anyRole(principal, [Role.SystemAdmin])
    const isAccountant = anyRole(principal, ACCOUNTING_ROLES)
    const isSenior = anyRole(principal, [Role.ChiefAccountant, Role.SystemAdmin])
    return {
      principal,
      isAdmin,
      canView: isAccountant,
      canRecord: isAccountant,
      canSubmit: isAccountant,
      canCancel: isSenior,
      canPostGl: isAccountant,
    }
  }, [principal])
}
