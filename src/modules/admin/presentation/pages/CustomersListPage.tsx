/**
 * Customers list. Adds a row action to open the customer's detail view
 * (`CustomerDetailPage`) — currently just the CRM portal-account panel;
 * everything else about the customer is edited from this list's dialog.
 */
import { useNavigate } from 'react-router-dom'

import { Button } from '@/shared/ui'

import { MasterListPage } from '../components/MasterListPage'

export function CustomersListPage() {
  const navigate = useNavigate()
  return (
    <MasterListPage
      entity="customer"
      extraRowActions={(row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(`/admin/customers/${row.$id}`)}
        >
          البوابة الإلكترونية
        </Button>
      )}
    />
  )
}
