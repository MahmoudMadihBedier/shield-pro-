import { useNavigate } from 'react-router-dom'

import { Button, Card, PageHeader } from '@/shared/ui'

import { PaymentVoucherForm } from '../components'
import { useAccountingPermissions } from '../hooks'

export function PaymentVoucherFormPage() {
  const navigate = useNavigate()
  const perms = useAccountingPermissions()

  return (
    <div className="space-y-4">
      <PageHeader
        title="سند جديد"
        titleEn="New voucher"
        actions={
          <Button variant="ghost" onClick={() => navigate('/accounting/vouchers')}>
            رجوع
          </Button>
        }
      />

      {!perms.canRecord ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">
          لا تملك صلاحية تسجيل سندات.
        </Card>
      ) : (
        <Card>
          <PaymentVoucherForm
            onCreated={(id) => navigate(`/accounting/vouchers/${id}`)}
            onCancel={() => navigate('/accounting/vouchers')}
          />
        </Card>
      )}
    </div>
  )
}
