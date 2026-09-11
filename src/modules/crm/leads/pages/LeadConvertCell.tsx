/**
 * The "convert" action for one lead row. Creating the actual `customers` row
 * happens on the normal Customers screen (geo / code / credit terms are a
 * business decision, not defaulted here) — this cell only lets a `won` lead
 * be linked back to the customer once it exists.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/shared/ui'

import type { LeadRow } from '../../domain/lead'
import { useLinkConvertedCustomer } from '../hooks'
import { useCustomerLinkOptions } from '../useCustomerLinkOptions'

export function LeadConvertCell({ lead }: { lead: LeadRow }) {
  const [linking, setLinking] = useState(false)
  const [customerId, setCustomerId] = useState('')
  const customers = useCustomerLinkOptions()
  const linkMutation = useLinkConvertedCustomer()

  if (lead.stage !== 'won') return null

  if (lead.converted_customer_id) {
    return (
      <Link
        to={`/admin/customers/${lead.converted_customer_id}`}
        className="text-xs text-emerald-700 underline dark:text-emerald-400"
      >
        مرتبط بعميل ✓
      </Link>
    )
  }

  if (!linking) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setLinking(true)}>
        ربط بعميل
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <select
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        className="rounded-lg border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/15"
      >
        <option value="">{customers.isLoading ? 'جارٍ التحميل…' : 'اختر عميلًا…'}</option>
        {(customers.data ?? []).map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        disabled={!customerId || linkMutation.isPending}
        onClick={() => {
          linkMutation.mutate({ id: lead.$id, customerId }, { onSuccess: () => setLinking(false) })
        }}
      >
        حفظ
      </Button>
      {linkMutation.isError ? (
        <span className="text-xs text-red-600 dark:text-red-400">{linkMutation.error.message}</span>
      ) : null}
    </div>
  )
}
