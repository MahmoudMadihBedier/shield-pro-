/**
 * Net owners' equity (capital contributed − drawings taken out), computed
 * live from the GL — never a stored/editable balance — plus a cross-link to
 * the sibling capital screen (contributions <-> withdrawals).
 */
import { Link } from 'react-router-dom'

import { formatCurrency } from '@/shared/formatters'
import { Card } from '@/shared/ui'

import { GlAccount } from '../../domain/gl'
import { netOwnersEquity, useAccountBalance } from '../hooks'

export interface CapitalSummaryBarProps {
  linkTo: string
  linkLabel: string
  linkLabelEn: string
}

export function CapitalSummaryBar({ linkTo, linkLabel, linkLabelEn }: CapitalSummaryBarProps) {
  const capital = useAccountBalance(GlAccount.OwnersCapital)
  const drawings = useAccountBalance(GlAccount.OwnersDrawings)
  const loading = capital.isLoading || drawings.isLoading
  const error = capital.isError || drawings.isError
  const net = netOwnersEquity(capital.data ?? 0, drawings.data ?? 0)

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-xs text-zinc-400">
          صافي رأس مال الملاك الحالي / Current net owners&apos; equity
        </div>
        <div className="mt-1 text-xl font-semibold" dir="ltr">
          {loading ? '…' : error ? '—' : formatCurrency(net)}
        </div>
      </div>
      <Link
        to={linkTo}
        className="text-sm font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
      >
        {linkLabel} / {linkLabelEn}
      </Link>
    </Card>
  )
}
