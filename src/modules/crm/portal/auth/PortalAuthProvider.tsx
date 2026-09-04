/**
 * CRM client-portal auth — a parallel, separate flow from staff auth
 * (`@/application/auth`). A customer is not a staff `Principal`: there is no
 * `users` profile row, no team/role membership, no branch pin — only a
 * `customers` row linked via `portal_user_id`.
 *
 * `login` authenticates straight against Appwrite Auth with the synthetic
 * portal email (`portalEmailForCode`) and the customer's PIN as the password
 * — Appwrite owns hashing/rate-limiting/sessions. The portal never reads
 * business data itself; `/portal/me` (a `shield-server` Function route)
 * resolves the caller's own customer record server-side.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'

import type { AppError } from '@/core/errors'
import { portalEmailForCode } from '@/core/portal'
import { mapAppwriteError } from '@/infrastructure/appwrite/errors'
import { getPortalMe } from '@/infrastructure/appwrite/functions'
import { account } from '@/infrastructure/appwrite/services'

import { portalKeys } from '../../query-keys'
import { PortalAuthContext, type PortalAuthContextValue, type PortalCustomer } from './portal-context'

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const session = useQuery<PortalCustomer | null, AppError>({
    queryKey: portalKeys.session(),
    queryFn: async () => {
      const result = await getPortalMe()
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
      try {
        await account.createEmailPasswordSession({
          email: portalEmailForCode(clientId),
          password: pin,
        })
      } catch (e) {
        throw mapAppwriteError(e)
      }

      const result = await getPortalMe()
      if (!result.ok) {
        // The Appwrite session is valid but no customer is linked (or the
        // link was revoked) — never leave a half-authenticated session.
        try {
          await account.deleteSession({ sessionId: 'current' })
        } catch {
          /* best effort */
        }
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
      try {
        await account.deleteSession({ sessionId: 'current' })
      } catch (e) {
        throw mapAppwriteError(e)
      }
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
