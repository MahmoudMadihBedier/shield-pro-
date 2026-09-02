import type { ReactNode } from 'react'

import { AuthProvider } from '@/application/auth/AuthProvider'

import { QueryProvider } from './QueryProvider'

/** Single composition point for every app-wide provider. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  )
}
