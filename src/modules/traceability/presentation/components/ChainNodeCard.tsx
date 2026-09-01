import { DocStatus } from '@/core/doc-status'
import { formatDateTime } from '@/shared/formatters'

import { entityLabel } from '../../domain/entity-labels'
import type { ChainNode } from '../../domain/chain-walker'

const STATUS_STYLES: Record<number, { ar: string; className: string }> = {
  [DocStatus.Draft]: {
    ar: 'مسودة',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  },
  [DocStatus.Submitted]: {
    ar: 'معتمد',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  [DocStatus.Cancelled]: {
    ar: 'ملغي',
    className: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  },
}

export function DocStatusPill({ status }: { status?: number }) {
  if (status == null) return null
  const style = STATUS_STYLES[status]
  if (!style) return null
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}>
      {style.ar}
    </span>
  )
}

export function ChainNodeCard({
  node,
  isFocused,
  onFocus,
}: {
  node: ChainNode
  isFocused: boolean
  onFocus: (refId: string) => void
}) {
  const label = entityLabel(node.entityType)

  return (
    <article
      className={`rounded-xl border p-4 text-sm shadow-sm transition ${
        isFocused
          ? 'border-zinc-900 bg-white ring-1 ring-zinc-900 dark:border-white dark:bg-zinc-900 dark:ring-white'
          : 'border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold">{node.refId}</span>
        <DocStatusPill status={node.docStatus} />
        {isFocused ? (
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900">
            العنصر المحدد
          </span>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-zinc-500">
        <span>{label.ar}</span>
        <span className="text-xs">/ {label.en}</span>
      </div>

      {node.createdAt ? (
        <p className="mt-2 text-xs text-zinc-500">أُنشئ في {formatDateTime(node.createdAt)}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>المصادر: {node.parents.length}</span>
        <span>المخرجات: {node.children.length}</span>
      </div>

      {!isFocused ? (
        <button
          type="button"
          onClick={() => onFocus(node.refId)}
          className="mt-3 inline-flex items-center rounded-lg border border-black/10 px-2.5 py-1 text-xs font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          توسيط هنا
        </button>
      ) : null}
    </article>
  )
}
