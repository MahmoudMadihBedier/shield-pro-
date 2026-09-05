/**
 * A horizontal bar list ranking products by net revenue — used for both
 * "top products" and "bottom products" (same mark, different data + heading).
 *
 * Built per the `dataviz` skill: one measure across categories is a
 * *sequential* job (magnitude, low→high), so every bar carries the same
 * single accent hue rather than a different color per bar — color-per-bar
 * would be categorical encoding for data that has no categorical identity.
 * Bars are ≤24px thick with a 4px rounded data-end, square at the baseline;
 * gridlines are hairline and recessive; the value is labeled at the bar tip
 * (or just outside it when the bar is too short to hold the label); each bar
 * carries a real `<title>` for accessibility, not a color-only encoding. A
 * single series needs no legend box (`marks-and-anatomy.md`).
 */
import { formatCurrency, formatNumber } from '@/shared/formatters'

import type { TopProduct } from '../../domain/sales-performance'

const ACCENT_LIGHT = '#2a78d6'
const ACCENT_DARK = '#3987e5'
const GRID_LIGHT = '#e1e0d9'
const GRID_DARK = '#2c2c2a'
const MUTED_LIGHT = '#898781'
const MUTED_DARK = '#898781'

export interface TopProductsChartProps {
  title: string
  titleEn: string
  rows: readonly TopProduct[]
  /** `productId -> display name`; falls back to the raw id when unresolved. */
  productLabel: ReadonlyMap<string, string>
  emptyMessage: string
}

const ROW_HEIGHT = 32
const BAR_HEIGHT = 20
const CHART_WIDTH = 520
const LABEL_WIDTH = 140
const PLOT_WIDTH = CHART_WIDTH - LABEL_WIDTH - 8

function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

export function TopProductsChart({
  title,
  titleEn,
  rows,
  productLabel,
  emptyMessage,
}: TopProductsChartProps) {
  const max = niceMax(Math.max(...rows.map((r) => r.netRevenue), 0))
  const height = Math.max(rows.length, 1) * ROW_HEIGHT + 8
  const ticks = [0, max / 2, max]

  return (
    <div className="reports-chart">
      <style>{`
        .reports-chart .rc-bar { fill: ${ACCENT_LIGHT}; }
        .reports-chart .rc-grid { stroke: ${GRID_LIGHT}; }
        .reports-chart .rc-muted { fill: ${MUTED_LIGHT}; }
        @media (prefers-color-scheme: dark) {
          .reports-chart .rc-bar { fill: ${ACCENT_DARK}; }
          .reports-chart .rc-grid { stroke: ${GRID_DARK}; }
          .reports-chart .rc-muted { fill: ${MUTED_DARK}; }
        }
      `}</style>
      <h3 className="mb-1 text-sm font-semibold">
        {title} <span className="text-zinc-400 dark:text-zinc-500">/ {titleEn}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${height}`}
          width="100%"
          role="img"
          aria-label={`${title} / ${titleEn}`}
          style={{ direction: 'ltr' }}
        >
          {ticks.map((t) => {
            const x = LABEL_WIDTH + (t / max) * PLOT_WIDTH
            return (
              <g key={t}>
                <line className="rc-grid" x1={x} x2={x} y1={0} y2={height - 16} strokeWidth={1} />
                <text className="rc-muted" x={x} y={height - 4} fontSize={10} textAnchor="middle">
                  {formatNumber(t, { maximumFractionDigits: 0 })}
                </text>
              </g>
            )
          })}
          {rows.map((row, i) => {
            const y = i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2
            const barWidth = Math.max((row.netRevenue / max) * PLOT_WIDTH, 0)
            const label = productLabel.get(row.productId) ?? row.productId
            const valueLabel = formatCurrency(row.netRevenue)
            // Label inside the bar when it fits with padding; otherwise just outside.
            const fitsInside = barWidth > valueLabel.length * 6 + 12
            return (
              <g key={row.productId}>
                <title>
                  {label}: {formatNumber(row.unitsSold)} units, {valueLabel}
                </title>
                <text
                  className="rc-muted"
                  x={LABEL_WIDTH - 8}
                  y={y + BAR_HEIGHT / 2 + 4}
                  fontSize={11}
                  textAnchor="end"
                >
                  {label.length > 18 ? `${label.slice(0, 17)}…` : label}
                </text>
                <rect
                  className="rc-bar"
                  x={LABEL_WIDTH}
                  y={y}
                  width={barWidth}
                  height={BAR_HEIGHT}
                  rx={4}
                />
                <text
                  x={fitsInside ? LABEL_WIDTH + barWidth - 6 : LABEL_WIDTH + barWidth + 6}
                  y={y + BAR_HEIGHT / 2 + 4}
                  fontSize={11}
                  textAnchor={fitsInside ? 'end' : 'start'}
                  className={fitsInside ? '' : 'rc-muted'}
                  fill={fitsInside ? '#ffffff' : undefined}
                >
                  {valueLabel}
                </text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
