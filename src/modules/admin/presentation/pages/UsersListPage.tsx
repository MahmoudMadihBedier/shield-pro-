/**
 * Staff accounts list. The System Admin creates and edits accounts here — the
 * create/edit dialog is the bespoke `StaffAccountForm` (email + password +
 * multi-role + branch/warehouse responsibilities) rather than the generic
 * master-data form. "Assign branch" stays as a quick row action.
 */
import { useState } from 'react'

import { useAuth } from '@/application/auth/context'
import { isSystemAdmin } from '@/core/rbac'
import { Button } from '@/shared/ui'

import { AssignBranchDialog } from '../components/AssignBranchDialog'
import { MasterListPage } from '../components/MasterListPage'
import { StaffAccountForm } from '../components/StaffAccountForm'
import type { User } from '../../domain/schemas'

export function UsersListPage() {
  const { principal } = useAuth()
  const canAssign = principal != null && isSystemAdmin(principal)
  const [assigning, setAssigning] = useState<User | null>(null)

  return (
    <>
      <MasterListPage
        entity="user"
        renderForm={({ mode, row, onDone }) => (
          <StaffAccountForm mode={mode} row={row} onDone={onDone} />
        )}
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
