/**
 * CRM client-portal auth — a parallel, separate flow from staff auth
 * (`@/application/auth`). A customer is not a staff `Principal`: there is no
 * `users` profile row, no team/role membership, no branch pin — only a
 * `customers` row linked via `portal_user_id`.
 *
 * `login` authenticates against Supabase Auth with the synthetic portal email
 * (`portalEmailForCode`) and the customer's PIN as the password — Supabase owns
 * hashing/rate-limiting/sessions. Every call runs on the dedicated
 * `portalSupabase` client (`infrastructure/appwrite/portal.ts`, its own
 * `storageKey`), so a customer session never overwrites a staff session in the
 * same browser. The portal never reads business data directly; `portal_me` (a
 * SECURITY DEFINER RPC) resolves the caller's own `customers` row server-side.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'

import type { AppError } from '@/core/errors'
import { portalEmailForCode } from '@/core/portal'
import { portalMe, portalSignIn, portalSignOut } from '@/infrastructure/appwrite/portal'

import { portalKeys } from '../../query-keys'
import {
  PortalAuthContext,
  type PortalAuthContextValue,
  type PortalCustomer,
} from './portal-context'

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const session = useQuery<PortalCustomer | null, AppError>({
    queryKey: portalKeys.session(),
    queryFn: async () => {
      const result = await portalMe()
      if (!result.ok) {
        if (result.error.code === 'unauthorized' || result.error.code === 'forbidden') return null
        throw result.error
      }
      return result.value
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  const loginMutation = useMutation<PortalCustomer, AppError, { clientId: string; pin: string }>({
    mutationFn: async ({ clientId, pin }) => {
      const signIn = await portalSignIn(portalEmailForCode(clientId), pin)
      if (!signIn.ok) throw signIn.error

      const result = await portalMe()
      if (!result.ok) {
        // The session is valid but no customer is linked (or the link was
        // revoked) — never leave a half-authenticated session.
        await portalSignOut()
        throw result.error
      }
      return result.value
    },
    onSuccess: (customer) => {
      queryClient.setQueryData(portalKeys.session(), customer)
    },
  })

  const logoutMutation = useMutation<void, AppError>({
    mutationFn: async () => {
      const res = await portalSignOut()
      if (!res.ok) throw res.error
    },
    onSettled: () => {
      queryClient.setQueryData(portalKeys.session(), null)
      void queryClient.invalidateQueries({ queryKey: portalKeys.root() })
    },
  })

  const value = useMemo<PortalAuthContextValue>(() => {
    const customer = session.data ?? null
    return {
      customer,
      status: session.isPending ? 'loading' : customer ? 'authenticated' : 'anonymous',
      error: (session.error as AppError | null) ?? loginMutation.error ?? null,
      login: async (clientId, pin) => {
        await loginMutation.mutateAsync({ clientId, pin })
      },
      logout: async () => {
        await logoutMutation.mutateAsync()
      },
    }
  }, [session.data, session.isPending, session.error, loginMutation, logoutMutation])

  return <PortalAuthContext value={value}>{children}</PortalAuthContext>
}
