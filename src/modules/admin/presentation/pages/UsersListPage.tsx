/**
 * Users (profile) list. Same generic list screen as the other master data,
 * plus a System-Admin-only "assign branch" row action.
 */
import { useState } from 'react'

import { useAuth } from '@/application/auth/context'
import { isSystemAdmin } from '@/core/rbac'
import { Button } from '@/shared/ui'

import { AssignBranchDialog } from '../components/AssignBranchDialog'
import { MasterListPage } from '../components/MasterListPage'
import type { User } from '../../domain/schemas'

export function UsersListPage() {
  const { principal } = useAuth()
  const canAssign = principal != null && isSystemAdmin(principal)
  const [assigning, setAssigning] = useState<User | null>(null)

  return (
    <>
      <MasterListPage
        entity="user"
        extraRowActions={
          canAssign
            ? (row) => (
                <Button size="sm" variant="secondary" onClick={() => setAssigning(row)}>
                  تعيين فرع
                </Button>
              )
            : undefined
        }
      />
      {assigning ? (
        <AssignBranchDialog user={assigning} onClose={() => setAssigning(null)} />
      ) : null}
    </>
  )
}
