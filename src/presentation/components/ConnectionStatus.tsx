import { useAppwriteHealth } from '@/application/health/useAppwriteHealth'
import { formatDateTime, formatRelativeLatency } from '@/shared/formatters'

/**
 * The Appwrite connection indicator + manual ping control — the "demo control
 * to send a ping to Appwrite" from the setup brief.
 */
export function ConnectionStatus() {
  const { data, error, isPending, isFetching, refetch } = useAppwriteHealth()

  const state: 'checking' | 'online' | 'offline' = isPending
    ? 'checking'
    : error
      ? 'offline'
      : 'online'

  const dot = {
    checking: 'bg-amber-400',
    online: 'bg-emerald-500',
    offline: 'bg-red-500',
  }[state]

  const label = {
    checking: 'Checking Appwrite…',
    online: 'Connected to Appwrite',
    offline: 'Cannot reach Appwrite',
  }[state]

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`inline-block size-2.5 shrink-0 rounded-full ${dot}`} />
        <span className="font-medium text-[var(--text)]">{label}</span>
        {state === 'online' && data ? (
          <span className="text-sm text-[var(--text-muted)]">
            · {formatRelativeLatency(data.latencyMs)}
          </span>
        ) : null}
      </div>

      {state === 'offline' && error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error.message}</p>
      ) : null}

      {state === 'online' && data ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Last checked {formatDateTime(data.checkedAt)}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void refetch()}
        disabled={isFetching}
        className="mt-4 inline-flex h-8 items-center rounded-lg bg-brand-600 px-3 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-400"
      >
        {isFetching ? 'Pinging…' : 'Ping now'}
      </button>
    </div>
  )
}
