import { Badge } from '@/shared/ui'

import { docStatusLabelAr, docStatusTone } from '../labels'

export function PortalDocStatusBadge({ status }: { status: number }) {
  return <Badge tone={docStatusTone(status)}>{docStatusLabelAr(status)}</Badge>
}
