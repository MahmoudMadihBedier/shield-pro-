/**
 * CRM hub — "my open follow-ups" + "leads by stage" at a glance, entry point
 * into the pipeline. `docs/CRM_PLAN.md` Phase A #3.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { isSystemAdmin } from '@/core/rbac'
import { formatDate } from '@/shared/formatters'
import { Badge, Card, PageHeader } from '@/shared/ui'

import { useLeads } from '../../leads/hooks'
import { LEAD_STAGES, leadStageLabel } from '../../domain/lead'
import { isOverdue } from '../../domain/followup'
import { useCustomerNameMap } from '../../useCustomerDirectory'
import { useMyOpenFollowups } from '../hooks'

export function CrmHomePage() {
  const { principal } = useAuth()
  const admin = principal != null && isSystemAdmin(principal)

  const followups = useMyOpenFollowups(principal?.userId)
  const customerNames = useCustomerNameMap()
  const leads = useLeads()

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>(LEAD_STAGES.map((s) => [s, 0]))
    for (const lead of leads.data ?? []) counts.set(lead.stage, (counts.get(lead.stage) ?? 0) + 1)
    return counts
  }, [leads.data])

  return (
    <div className="space-y-4">
      <PageHeader
        title="بوابة CRM"
        titleEn="CRM hub"
        description="متابعاتك المفتوحة وحالة خط الفرص، في مكان واحد."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">متابعاتي المفتوحة / My open follow-ups</h3>
            {followups.data && followups.data.length > 0 ? (
              <Badge tone="neutral">{followups.data.length}</Badge>
            ) : null}
          </div>
          {followups.isLoading ? (
            <p className="text-sm text-zinc-500">جارٍ التحميل…</p>
          ) : followups.isError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{followups.error.message}</p>
          ) : !followups.data || followups.data.length === 0 ? (
            <p className="text-sm text-zinc-500">لا توجد متابعات مفتوحة مسندة إليك.</p>
          ) : (
            <ul className="divide-y divide-black/5 text-sm dark:divide-white/5">
              {followups.data.map((f) => {
                const overdue = isOverdue(f)
                const customerName = customerNames.get(f.customer_id) ?? f.customer_id
                return (
                  <li key={f.$id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{f.title}</p>
                      <p className="truncate text-xs text-zinc-400">
                        {admin ? (
                          <Link to={`/admin/customers/${f.customer_id}`} className="underline">
                            {customerName}
                          </Link>
                        ) : (
                          customerName
                        )}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs ${overdue ? 'font-medium text-red-600 dark:text-red-400' : 'text-zinc-400'}`}
                      dir="ltr"
                    >
                      {overdue ? 'متأخرة · ' : ''}
                      {formatDate(f.due_date)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">الفرص حسب المرحلة / Leads by stage</h3>
            <Link to="/crm/leads" className="text-xs underline">
              عرض الكل
            </Link>
          </div>
          {leads.isLoading ? (
            <p className="text-sm text-zinc-500">جارٍ التحميل…</p>
          ) : leads.isError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{leads.error.message}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {LEAD_STAGES.map((stage) => (
                <li key={stage} className="flex items-center justify-between">
                  <span>{leadStageLabel(stage)}</span>
                  <span className="tabular-nums text-zinc-500" dir="ltr">
                    {stageCounts.get(stage) ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <Link to="/crm/leads" className="text-sm font-medium underline">
          فتح خط الفرص / Open the leads pipeline
        </Link>
      </Card>
    </div>
  )
}
