import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, type ReactNode } from 'react'

import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'
import type { Principal } from '@/core/rbac'
import {
  login as loginRequest,
  loadPrincipal,
  logout as logoutRequest,
} from '@/infrastructure/appwrite/auth'

import { AuthContext, type AuthContextValue } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const session = useQuery<Principal | null, AppError>({
    queryKey: queryKeys.auth.session(),
    queryFn: async () => {
      const result = await loadPrincipal()
      if (!result.ok) throw result.error
      return result.value
    },
    staleTime: 5 * 60_000,
    retry: false,
  })

  const loginMutation = useMutation<Principal, AppError, { email: string; password: string }>({
    mutationFn: async ({ email, password }) => {
      const result = await loginRequest(email, password)
      if (!result.ok) throw result.error
      return result.value
    },
    onSuccess: (principal) => {
      queryClient.setQueryData(queryKeys.auth.session(), principal)
    },
  })

  const logoutMutation = useMutation<void, AppError>({
    mutationFn: async () => {
      const result = await logoutRequest()
      if (!result.ok) throw result.error
    },
    onSettled: () => {
      queryClient.setQueryData(queryKeys.auth.session(), null)
      void queryClient.invalidateQueries()
    },
  })

  const value = useMemo<AuthContextValue>(() => {
    const principal = session.data ?? null
    return {
      principal,
      status: session.isPending ? 'loading' : principal ? 'authenticated' : 'anonymous',
      error: (session.error as AppError | null) ?? loginMutation.error ?? null,
      login: async (email, password) => {
        await loginMutation.mutateAsync({ email, password })
      },
      logout: async () => {
        await logoutMutation.mutateAsync()
      },
    }
  }, [session.data, session.isPending, session.error, loginMutation, logoutMutation])

  return <AuthContext value={value}>{children}</AuthContext>
}
