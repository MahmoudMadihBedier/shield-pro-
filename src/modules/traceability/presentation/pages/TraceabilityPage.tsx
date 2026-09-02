import { useMemo, useState, type ReactNode } from 'react'

import { isReferenceId } from '@/core/reference-id'

import { linearize } from '../../domain/chain-walker'
import { ChainNodeCard } from '../components/ChainNodeCard'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useDocumentChain } from '../hooks/useDocumentChain'

function Notice({ tone, children }: { tone: 'info' | 'warn' | 'error'; children: ReactNode }) {
  const styles = {
    info: 'border-black/10 bg-white text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300',
    warn: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
    error:
      'border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  }[tone]
  return <div className={`rounded-xl border p-4 text-sm ${styles}`}>{children}</div>
}

function Connector() {
  return <div className="mx-auto my-1 h-4 w-px bg-black/15 dark:bg-white/15" aria-hidden />
}

export function TraceabilityPage() {
  const [rawSearch, setRawSearch] = useState('')
  const [focusRef, setFocusRef] = useState<string | null>(null)

  const debounced = useDebouncedValue(rawSearch.trim())
  const searchIsValid = debounced.length === 0 || isReferenceId(debounced)
  const root = focusRef ?? (isReferenceId(debounced) ? debounced : null)

  const { data: graph, isLoading, isError, error, isFetching } = useDocumentChain(root)

  const view = useMemo(() => {
    if (!graph || !root) return null
    const focused = graph.nodes[root]
    if (!focused) return { focused: null, ancestors: [], descendants: [] }
    return {
      focused,
      ancestors: linearize(graph, 'ancestors', root).reverse(),
      descendants: linearize(graph, 'descendants', root),
    }
  }, [graph, root])

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">تتبع المستندات</h2>
        <p className="mt-1 text-sm text-zinc-500">
          أدخل رقم مرجع مستند (مثل <span className="font-mono">INV-2026-00042</span>) لعرض سلسلة
          المستندات المرتبطة به صعوداً ونزولاً.
        </p>
      </header>

      <div>
        <label htmlFor="trace-search" className="mb-1 block text-sm font-medium">
          رقم المرجع
        </label>
        <input
          id="trace-search"
          type="search"
          dir="ltr"
          value={rawSearch}
          onChange={(e) => {
            setRawSearch(e.target.value)
            setFocusRef(null)
          }}
          placeholder="INV-2026-00042"
          className="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-start font-mono text-sm outline-none focus:border-zinc-900 dark:border-white/15 dark:bg-zinc-900 dark:focus:border-white"
        />
        {!searchIsValid ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            صيغة رقم المرجع غير صحيحة. المتوقع: <span className="font-mono">PREFIX-YYYY-NNNNN</span>
          </p>
        ) : null}
      </div>

      {root == null ? (
        <Notice tone="info">
          {debounced.length === 0
            ? 'ابدأ بإدخال رقم مرجع للبحث في سلسلة التتبع.'
            : 'أدخل رقم مرجع صالح لبدء التتبع.'}
        </Notice>
      ) : null}

      {root != null && isLoading ? <Notice tone="info">جارٍ تتبع السلسلة…</Notice> : null}

      {root != null && isError ? (
        <Notice tone="error">تعذر تتبع السلسلة. {error?.message ?? 'حدث خطأ غير متوقع.'}</Notice>
      ) : null}

      {root != null && !isLoading && !isError && view && !view.focused ? (
        <Notice tone="warn">
          لا يوجد مستند بالرقم <span className="font-mono">{root}</span>. تأكد من الرقم وحاول
          مجدداً.
        </Notice>
      ) : null}

      {view?.focused ? (
        <section aria-label="سلسلة التتبع" className="space-y-1">
          {graph?.truncated ? (
            <Notice tone="warn">
              تم اقتطاع السلسلة عند بلوغ الحد الأقصى لعدد المستندات. النتائج المعروضة غير مكتملة.
            </Notice>
          ) : null}

          {isFetching ? <p className="text-xs text-zinc-500">جارٍ التحديث…</p> : null}

          {view.ancestors.length > 0 ? (
            <p className="pt-2 text-xs font-medium text-zinc-500">المصادر (أعلى السلسلة)</p>
          ) : null}
          {view.ancestors.map((refId) => {
            const node = graph?.nodes[refId]
            if (!node) return null
            return (
              <div key={refId}>
                <ChainNodeCard node={node} isFocused={false} onFocus={setFocusRef} />
                <Connector />
              </div>
            )
          })}

          <ChainNodeCard node={view.focused} isFocused onFocus={setFocusRef} />

          {view.descendants.length > 0 ? (
            <>
              <Connector />
              <p className="text-xs font-medium text-zinc-500">المخرجات (أسفل السلسلة)</p>
            </>
          ) : null}
          {view.descendants.map((refId) => {
            const node = graph?.nodes[refId]
            if (!node) return null
            return (
              <div key={refId}>
                <Connector />
                <ChainNodeCard node={node} isFocused={false} onFocus={setFocusRef} />
              </div>
            )
          })}
        </section>
      ) : null}
    </div>
  )
}
