import { Link } from 'react-router-dom'

import { Logo } from '@/shared/ui'

/** App logo in the top bar — links home. */
export function BrandMark() {
  return (
    <Link to="/" className="flex shrink-0 items-center" aria-label="Shield Pro">
      <Logo className="h-7 sm:h-8" />
    </Link>
  )
}
