/**
 * Staff-facing panel for a customer detail view: create / reset / revoke the
 * customer's CRM portal Auth account. Meant to be dropped into
 * `CustomersListPage`'s row-expansion or a customer detail page — the
 * coordinator (or a follow-up) wires the mount point; this module doesn't
 * touch `@/modules/admin` itself.
 */
import { useState } from 'react'

import type { Customer } from '@/modules/admin'
import { Badge, Button, Card } from '@/shared/ui'

import { useCreatePortalAccount, useResetPortalPin, useRevokePortalAccess } from './hooks'

/**
 * `customers.portal_user_id` (added this session) isn't on the `admin`
 * module's `customerRowSchema` yet — extended locally here rather than
 * editing `@/modules/admin` (out of scope for this module).
 */
export interface PortalLinkedCustomer extends Customer {
  portal_user_id?: string | null
}

export interface PortalAccountPanelProps {
  customer: PortalLinkedCustomer
  /** Fires after any successful create/reset/revoke so the host page can refresh its own customer query. */
  onChanged?: () => void
}

interface RevealedPin {
  action: 'create' | 'reset'
  pin: string
}

export function PortalAccountPanel({ customer, onChanged }: PortalAccountPanelProps) {
  const [revealed, setRevealed] = useState<RevealedPin | null>(null)
  const [copied, setCopied] = useState(false)

  const create = useCreatePortalAccount()
  const reset = useResetPortalPin()
  const revoke = useRevokePortalAccess()

  const linked = Boolean(customer.portal_user_id)
  const isPending = create.isPending || reset.isPending || revoke.isPending
  const activeError = create.error ?? reset.error ?? revoke.error
  // A revoke bans the auth user but keeps `portal_user_id` set — so the account
  // is still "linked" but access is off. A subsequent PIN reset lifts the ban
  // (reactivates). We only know the ban state from actions taken in this panel.
  const revoked = revoke.isSuccess && !reset.isSuccess

  async function handleCreate() {
    setCopied(false)
    const result = await create.mutateAsync({ customerId: customer.$id })
    setRevealed({ action: 'create', pin: result.pin })
    onChanged?.()
  }

  async function handleReset() {
    setCopied(false)
    const result = await reset.mutateAsync({ customerId: customer.$id })
    setRevealed({ action: 'reset', pin: result.pin })
    onChanged?.()
  }

  async function handleRevoke() {
    setRevealed(null)
    await revoke.mutateAsync({ customerId: customer.$id })
    onChanged?.()
  }

  async function copyPin() {
    if (!revealed) return
    try {
      await navigator.clipboard.writeText(revealed.pin)
      setCopied(true)
    } catch {
      /* clipboard access can be denied — the PIN is still visible on screen */
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">حساب بوابة العملاء / CRM portal account</h3>
        <Badge tone={!linked ? 'neutral' : revoked ? 'danger' : 'success'}>
          {!linked ? 'غير مرتبط' : revoked ? 'موقوف' : 'مرتبط'}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {!linked ? (
          <Button size="sm" disabled={isPending} onClick={() => void handleCreate()}>
            إنشاء حساب البوابة
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => void handleReset()}
            >
              {revoked ? 'إعادة التفعيل برقم سري جديد' : 'إعادة تعيين الرقم السري'}
            </Button>
            {!revoked ? (
              <Button
                size="sm"
                variant="danger"
                disabled={isPending}
                onClick={() => void handleRevoke()}
              >
                إلغاء الوصول
              </Button>
            ) : null}
          </>
        )}
      </div>

      {activeError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {activeError.message}
        </p>
      ) : null}

      {revoke.isSuccess ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          تم إلغاء وصول العميل إلى البوابة.
        </p>
      ) : null}

      {revealed ? (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="font-medium text-amber-900 dark:text-amber-300">
            {revealed.action === 'create'
              ? 'تم إنشاء الحساب. الرقم السري:'
              : 'تم تعيين رقم سري جديد:'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code
              dir="ltr"
              className="rounded bg-white px-2 py-1 font-mono text-base dark:bg-zinc-900"
            >
              {revealed.pin}
            </code>
            <Button size="sm" variant="secondary" onClick={() => void copyPin()}>
              {copied ? 'تم النسخ' : 'نسخ'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
              إغلاق
            </Button>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-400">
            لن يُعرض هذا الرقم مرة أخرى — أبلغ العميل به الآن.
            <br />
            This PIN will not be shown again — communicate it to the customer now.
          </p>
        </div>
      ) : null}
    </Card>
  )
}
