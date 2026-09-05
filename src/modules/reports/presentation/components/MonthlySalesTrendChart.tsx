/**
 * Monthly net-revenue trend — a single-series line/area chart. Built per the
 * `dataviz` skill's mark specs: a 2px round-joined line, a ~10%-opacity area
 * wash (never a saturated block), an ≥8px end-marker with a surface ring, and
 * the value labeled at the line's end (`marks-and-anatomy.md`). One series
 * needs no legend box — the chart title already names what's plotted.
 */
import { formatCurrency, formatNumber } from '@/shared/formatters'

import type { MonthlyRevenue } from '../../domain/sales-performance'

const ACCENT_LIGHT = '#2a78d6'
const ACCENT_DARK = '#3987e5'
const GRID_LIGHT = '#e1e0d9'
const GRID_DARK = '#2c2c2a'
const MUTED_LIGHT = '#898781'
const MUTED_DARK = '#898781'
const SURFACE_LIGHT = '#fcfcfb'
const SURFACE_DARK = '#1a1a19'

export interface MonthlySalesTrendChartProps {
  title: string
  titleEn: string
  rows: readonly MonthlyRevenue[]
  emptyMessage: string
}

const WIDTH = 560
const HEIGHT = 200
const PAD_LEFT = 48
const PAD_RIGHT = 16
const PAD_TOP = 16
const PAD_BOTTOM = 28
const PLOT_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT
const PLOT_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM

function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

function monthShortLabel(month: string): string {
  const [, m] = month.split('-')
  const idx = Number(m) - 1
  const names = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
  return names[idx] ?? month
}

export function MonthlySalesTrendChart({
  title,
  titleEn,
  rows,
  emptyMessage,
}: MonthlySalesTrendChartProps) {
  if (rows.length === 0) {
    return (
      <div className="reports-chart">
        <h3 className="mb-1 text-sm font-semibold">
          {title} <span className="text-zinc-400 dark:text-zinc-500">/ {titleEn}</span>
        </h3>
        <p className="py-6 text-center text-sm text-zinc-500">{emptyMessage}</p>
      </div>
    )
  }

  const max = niceMax(Math.max(...rows.map((r) => r.netRevenue)))
  const stepX = rows.length > 1 ? PLOT_WIDTH / (rows.length - 1) : 0
  const points = rows.map((r, i) => {
    const x = PAD_LEFT + i * stepX
    const y = PAD_TOP + PLOT_HEIGHT - (r.netRevenue / max) * PLOT_HEIGHT
    return { x, y, row: r }
  })
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${points[points.length - 1]?.x},${PAD_TOP + PLOT_HEIGHT} L${points[0]?.x},${PAD_TOP + PLOT_HEIGHT} Z`
  const last = points[points.length - 1]
  const ticks = [0, max / 2, max]

  return (
    <div className="reports-chart">
      <style>{`
        .reports-chart .rc-line { stroke: ${ACCENT_LIGHT}; }
        .reports-chart .rc-area { fill: ${ACCENT_LIGHT}; opacity: 0.1; }
        .reports-chart .rc-dot { fill: ${ACCENT_LIGHT}; stroke: ${SURFACE_LIGHT}; }
        .reports-chart .rc-grid { stroke: ${GRID_LIGHT}; }
        .reports-chart .rc-muted { fill: ${MUTED_LIGHT}; }
        @media (prefers-color-scheme: dark) {
          .reports-chart .rc-line { stroke: ${ACCENT_DARK}; }
          .reports-chart .rc-area { fill: ${ACCENT_DARK}; opacity: 0.12; }
          .reports-chart .rc-dot { fill: ${ACCENT_DARK}; stroke: ${SURFACE_DARK}; }
          .reports-chart .rc-grid { stroke: ${GRID_DARK}; }
          .reports-chart .rc-muted { fill: ${MUTED_DARK}; }
        }
      `}</style>
      <h3 className="mb-1 text-sm font-semibold">
        {title} <span className="text-zinc-400 dark:text-zinc-500">/ {titleEn}</span>
      </h3>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label={`${title} / ${titleEn}`}
        style={{ direction: 'ltr' }}
      >
        {ticks.map((t) => {
          const y = PAD_TOP + PLOT_HEIGHT - (t / max) * PLOT_HEIGHT
          return (
            <g key={t}>
              <line className="rc-grid" x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} strokeWidth={1} />
              <text className="rc-muted" x={PAD_LEFT - 6} y={y + 3} fontSize={10} textAnchor="end">
                {formatNumber(t, { maximumFractionDigits: 0 })}
              </text>
            </g>
          )
        })}

        <path className="rc-area" d={areaPath} stroke="none" />
        <path className="rc-line" d={linePath} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p) => (
          <g key={p.row.month}>
            <title>
              {monthShortLabel(p.row.month)} {p.row.month.slice(0, 4)}: {formatCurrency(p.row.netRevenue)}
            </title>
            <circle className="rc-dot" cx={p.x} cy={p.y} r={4} strokeWidth={2} />
            <text className="rc-muted" x={p.x} y={HEIGHT - 8} fontSize={10} textAnchor="middle">
              {monthShortLabel(p.row.month).slice(0, 3)}
            </text>
          </g>
        ))}

        {last ? (
          <text x={last.x} y={last.y - 10} fontSize={11} fontWeight={600} textAnchor="end" className="rc-muted">
            {formatCurrency(last.row.netRevenue)}
          </text>
        ) : null}
      </svg>
    </div>
  )
}
