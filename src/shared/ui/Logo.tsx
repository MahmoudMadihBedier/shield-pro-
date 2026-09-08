import logoUrl from '@/assets/logo.png'

import { APP_NAME } from '@/shared/constants'

export interface LogoProps {
  /** Height utility, e.g. `h-7` (default) / `h-10`. Width auto-scales. */
  className?: string
  /**
   * In dark mode the black line-art logo is inverted to white. Set `false` when
   * the logo sits on a light surface even in dark mode (e.g. a printed bill).
   */
  invertOnDark?: boolean
}

/**
 * The Shield Pro wordmark. Rendered from `src/assets/logo.png` (Vite bundles +
 * hashes it); the design master is `assets/logo.png` at the repo root.
 */
export function Logo({ className = 'h-7', invertOnDark = true }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt={APP_NAME}
      className={`w-auto object-contain ${className} ${invertOnDark ? 'dark:invert' : ''}`}
      draggable={false}
    />
  )
}
