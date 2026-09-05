/**
 * A single dashboard stat tile: `label` + `value`, optional signed `delta`
 * and an optional 12-point sparkline — the `dataviz` skill's stat-tile
 * contract (`references/marks-and-anatomy.md` § Figures). Text stays in text
 * tokens (never the series color); the sparkline uses the sequential-blue
 * accent, matching the two dashboard charts.
 */
import { Card } from '@/shared/ui'

const ACCENT_LIGHT = '#2a78d6'
const ACCENT_DARK = '#3987e5'

export interface KpiCardProps {
  /** Arabic-first label. */
  label: string
  labelEn: string
  value: string
  isLoading?: boolean
  isError?: boolean
  /**
   * Signed delta vs a named period, e.g. `{ value: '+12.4%', period: 'الشهر الماضي', isGood: true }`.
   * `isGood` decides the arrow direction's color — a rise isn't always good
   * (e.g. SLA breach counts), so the caller states it explicitly.
   */
  delta?: { value: string; period: string; isGood: boolean }
  /** A trailing series of values for a 12-point sparkline (oldest first). */
  trend?: readonly number[]
}

function Sparkline({ values }: { values: readonly number[] }) {
  if (values.length < 2) return null
  const width = 96
  const height = 28
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = width / (values.length - 1)
  const points = values.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / span) * height
    return `${x},${y}`
  })
  const last = points[points.length - 1]?.split(',').map(Number) ?? [width, height / 2]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="اتجاه آخر الفترات / recent trend"
      className="reports-kpi-sparkline"
    >
      <style>{`
        .reports-kpi-sparkline .rk-line { stroke: ${ACCENT_LIGHT}; }
        .reports-kpi-sparkline .rk-dot { fill: ${ACCENT_LIGHT}; }
        @media (prefers-color-scheme: dark) {
          .reports-kpi-sparkline .rk-line { stroke: ${ACCENT_DARK}; }
          .reports-kpi-sparkline .rk-dot { fill: ${ACCENT_DARK}; }
        }
      `}</style>
      <polyline className="rk-line" points={points.join(' ')} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle className="rk-dot" cx={last[0]} cy={last[1]} r={2.5} />
    </svg>
  )
}

export function KpiCard({ label, labelEn, value, isLoading, isError, delta, trend }: KpiCardProps) {
  // Status colors (good/warning/serious/critical) are reserved — never reused
  // for a series — and shipped with a directional sign, never color alone.
  const deltaColorClass = delta
    ? delta.isGood
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-red-700 dark:text-red-400'
    : ''

  return (
    <Card className="flex flex-col gap-1">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {label} <span className="text-zinc-400 dark:text-zinc-500">/ {labelEn}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="text-2xl font-semibold" dir="ltr">
          {isLoading ? '…' : isError ? '—' : value}
        </div>
        {trend && trend.length >= 2 ? <Sparkline values={trend} /> : null}
      </div>
      {delta && !isLoading && !isError ? (
        <div className={`text-xs ${deltaColorClass}`} dir="ltr">
          {delta.value} <span className="text-zinc-400 dark:text-zinc-500">vs {delta.period}</span>
        </div>
      ) : null}
    </Card>
  )
}
