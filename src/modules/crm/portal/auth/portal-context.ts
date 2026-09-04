import { createContext, use } from 'react'

import type { AppError } from '@/core/errors'
import type { PortalMeResult } from '@/infrastructure/appwrite/functions'

/** The signed-in customer's own profile, as returned by `/portal/me`. */
export type PortalCustomer = PortalMeResult

export interface PortalAuthContextValue {
  customer: PortalCustomer | null
  status: 'loading' | 'authenticated' | 'anonymous'
  error: AppError | null
  login: (clientId: string, pin: string) => Promise<void>
  logout: () => Promise<void>
}

export const PortalAuthContext = createContext<PortalAuthContextValue | null>(null)

export function usePortalAuth(): PortalAuthContextValue {
  const ctx = use(PortalAuthContext)
  if (!ctx) throw new Error('usePortalAuth must be used within <PortalAuthProvider>')
  return ctx
}
