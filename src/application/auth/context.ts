import { createContext, use } from 'react'

import type { AppError } from '@/core/errors'
import type { Principal } from '@/core/rbac'

export interface AuthContextValue {
  principal: Principal | null
  status: 'loading' | 'authenticated' | 'anonymous'
  error: AppError | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
