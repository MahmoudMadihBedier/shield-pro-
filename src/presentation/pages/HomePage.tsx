import { Link } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { NAV_GROUPS } from '@/presentation/layout/nav'
import { RequireRole } from '@/presentation/components/RequireRole'
import { ConnectionStatus } from '@/presentation/components/ConnectionStatus'
import { config } from '@/shared/config'
import { Card, PageHeader } from '@/shared/ui'

export function HomePage() {
  const { principal } = useAuth()
  const modules = NAV_GROUPS.filter((g) => g.to !== '/')

  return (
    <div className="space-y-6">
      <PageHeader
        title="مرحبًا بك"
        titleEn="Overview"
        description="اختصار سريع لوحدات النظام وحالة الاتصال بالخادم."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {modules.map((group) => {
          const card = (
            <Link key={group.to} to={group.to} className="block">
              <Card interactive className="h-full">
                <p className="font-semibold text-[var(--text)]">{group.label}</p>
                <p className="mt-0.5 text-xs text-[var(--text-subtle)]">{group.labelEn}</p>
                {group.items.length > 0 ? (
                  <p className="mt-3 text-xs text-[var(--text-muted)]">{group.items.length} شاشة</p>
                ) : null}
              </Card>
            </Link>
          )
          return group.roles ? (
            <RequireRole key={group.to} anyOf={group.roles}>
              {card}
            </RequireRole>
          ) : (
            card
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text)]">اتصال الخادم / Backend</h3>
          <ConnectionStatus />
        </div>

        <Card>
          <h3 className="mb-3 text-sm font-semibold">مشروع Supabase</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-[var(--text-muted)]">Project URL</dt>
            <dd className="font-mono break-all">{config.supabaseUrl}</dd>
            <dt className="text-[var(--text-muted)]">Publishable key</dt>
            <dd className="font-mono break-all">{config.supabasePublishableKey.slice(0, 12)}…</dd>
            {principal ? (
              <>
                <dt className="text-[var(--text-muted)]">الدور</dt>
                <dd className="font-mono">{principal.roles.join(', ') || '—'}</dd>
              </>
            ) : null}
          </dl>
        </Card>
      </div>
    </div>
  )
}
