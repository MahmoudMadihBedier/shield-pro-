import { useNavigate } from 'react-router-dom'

import { Card, PageHeader } from '@/shared/ui'
import { Button } from '@/shared/ui'

import { ReceiptForm } from '../components'
import { useAccountingPermissions } from '../hooks'

export function ReceiptFormPage() {
  const navigate = useNavigate()
  const perms = useAccountingPermissions()

  return (
    <div className="space-y-4">
      <PageHeader
        title="سند تحصيل جديد"
        titleEn="New collection"
        actions={
          <Button variant="ghost" onClick={() => navigate('/accounting/receipts')}>
            رجوع
          </Button>
        }
      />

      {!perms.canRecord ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">
          لا تملك صلاحية تسجيل تحصيل.
        </Card>
      ) : (
        <Card>
          <ReceiptForm
            onCreated={(id) => navigate(`/accounting/receipts/${id}`)}
            onCancel={() => navigate('/accounting/receipts')}
          />
        </Card>
      )}
    </div>
  )
}
