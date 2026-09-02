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
    <div className="rounded-xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${dot}`} />
        <span className="font-medium">{label}</span>
        {state === 'online' && data ? (
          <span className="text-sm text-zinc-500">· {formatRelativeLatency(data.latencyMs)}</span>
        ) : null}
      </div>

      {state === 'offline' && error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error.message}</p>
      ) : null}

      {state === 'online' && data ? (
        <p className="mt-2 text-sm text-zinc-500">Last checked {formatDateTime(data.checkedAt)}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void refetch()}
        disabled={isFetching}
        className="mt-4 inline-flex items-center rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {isFetching ? 'Pinging…' : 'Ping now'}
      </button>
    </div>
  )
}
