import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { usePortalAuth } from '../auth/portal-context'

/** Gate a portal route on an authenticated customer session; bounce anonymous visitors to /portal/login. */
export function RequirePortalAuth({ children }: { children: ReactNode }) {
  const { status } = usePortalAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        جارٍ التحميل…
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/portal/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
