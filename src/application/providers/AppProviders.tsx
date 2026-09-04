import type { ReactNode } from 'react'

import { AuthProvider } from '@/application/auth/AuthProvider'
import { PortalAuthProvider } from '@/modules/crm'

import { QueryProvider } from './QueryProvider'

/**
 * Single composition point for every app-wide provider. `AuthProvider` (staff)
 * and `PortalAuthProvider` (CRM customers) are independent — a browser is
 * never both at once, but both contexts are always mounted so `/login` and
 * `/portal/login` each resolve their own session without knowing about the
 * other.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <PortalAuthProvider>{children}</PortalAuthProvider>
      </AuthProvider>
    </QueryProvider>
  )
}
