import { ConnectionStatus } from '@/presentation/components/ConnectionStatus'
import { config } from '@/shared/config'

export function HomePage() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold">Backend connection</h2>
        <p className="mb-4 text-sm text-zinc-500">
          The app pings Appwrite once at startup (see the browser console) and on the interval
          below. Use the button to check on demand.
        </p>
        <ConnectionStatus />
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-5 text-sm shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-3 text-base font-semibold">Appwrite project</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-zinc-500">Name</dt>
          <dd className="font-mono">{config.appwriteProjectName}</dd>
          <dt className="text-zinc-500">Project ID</dt>
          <dd className="font-mono">{config.appwriteProjectId}</dd>
          <dt className="text-zinc-500">Endpoint</dt>
          <dd className="font-mono break-all">{config.appwriteEndpoint}</dd>
        </dl>
      </section>

      <section className="text-sm text-zinc-500">
        Next: see <code className="font-mono">docs/IMPLEMENTATION_PLAN.md</code> for the phased
        build and <code className="font-mono">docs/APPWRITE_SETUP.md</code> for backend
        provisioning.
      </section>
    </div>
  )
}
