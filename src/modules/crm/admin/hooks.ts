/**
 * Staff-side mutations for managing a customer's CRM portal Auth account.
 * Each wraps one of the three `portal-account` Function routes
 * (`@/infrastructure/appwrite/functions`). No query invalidation of the
 * `admin` module's own customer list/detail queries happens here — this
 * module never touches `@/application/query/keys` (off-limits) or reaches
 * into `@/modules/admin` internals; the caller (wherever `PortalAccountPanel`
 * is mounted) invalidates its own customer query on success if it wants the
 * list to refresh.
 */
import { useMutation } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import {
  createPortalAccount as createPortalAccountRequest,
  resetPortalPin as resetPortalPinRequest,
  revokePortalAccess as revokePortalAccessRequest,
  type CreatePortalAccountResult,
  type ResetPortalPinResult,
  type RevokePortalAccessResult,
} from '@/infrastructure/appwrite/functions'

export interface PortalAccountMutationInput {
  customerId: string
}

export function useCreatePortalAccount() {
  return useMutation<CreatePortalAccountResult, AppError, PortalAccountMutationInput>({
    mutationFn: async ({ customerId }) => {
      const result = await createPortalAccountRequest({ customerId })
      if (!result.ok) throw result.error
      return result.value
    },
  })
}

export function useResetPortalPin() {
  return useMutation<ResetPortalPinResult, AppError, PortalAccountMutationInput>({
    mutationFn: async ({ customerId }) => {
      const result = await resetPortalPinRequest({ customerId })
      if (!result.ok) throw result.error
      return result.value
    },
  })
}

export function useRevokePortalAccess() {
  return useMutation<RevokePortalAccessResult, AppError, PortalAccountMutationInput>({
    mutationFn: async ({ customerId }) => {
      const result = await revokePortalAccessRequest({ customerId })
      if (!result.ok) throw result.error
      return result.value
    },
  })
}
