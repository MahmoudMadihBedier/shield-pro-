import type { ReactNode } from 'react'

import { QueryProvider } from './QueryProvider'

/** Single composition point for every app-wide provider. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>
}
