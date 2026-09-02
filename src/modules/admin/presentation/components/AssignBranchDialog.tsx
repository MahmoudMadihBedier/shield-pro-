/**
 * System-Admin-only action: bind a staff member to a branch
 * (`IMPLEMENTATION_PLAN.md` §4.6). Writes `users.branch_id` via
 * `usersRepo.setBranch`.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import { Button } from '@/shared/ui'
import { FormError } from '@/shared/forms'

import { usersRepo } from '../../data/users-repo'
import type { User } from '../../domain/schemas'
import { useRelationOptions } from '../hooks/useRelationOptions'
import { EntityDialog } from './EntityDialog'

export function AssignBranchDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const queryClient = useQueryClient()
  const branches = useRelationOptions('branch')
  const [branchId, setBranchId] = useState<string>(user.branch_id ?? '')

  const mutation = useMutation<User, AppError, string | null>({
    mutationFn: async (value) => {
      const result = await usersRepo.setBranch(user.$id, value)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'list', 'user'] })
      onClose()
    },
  })

  return (
    <EntityDialog
      open
      title={`تعيين فرع — ${user.full_name}`}
      titleEn="Assign branch"
      onClose={onClose}
    >
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">
            الفرع / Branch
          </span>
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            disabled={branches.isLoading}
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          >
            <option value="">— بدون فرع —</option>
            {(branches.data ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {mutation.isError ? <FormError message={mutation.error.message} /> : null}

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            إلغاء
          </Button>
          <Button
            onClick={() => mutation.mutate(branchId === '' ? null : branchId)}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'جارٍ الحفظ…' : 'حفظ'}
          </Button>
        </div>
      </div>
    </EntityDialog>
  )
}
