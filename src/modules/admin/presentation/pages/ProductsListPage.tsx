/**
 * Products list. Adds a row action to open the product's BOM
 * (`ProductDetailPage`).
 */
import { useNavigate } from 'react-router-dom'

import { Button } from '@/shared/ui'

import { MasterListPage } from '../components/MasterListPage'

export function ProductsListPage() {
  const navigate = useNavigate()
  return (
    <MasterListPage
      entity="product"
      extraRowActions={(row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(`/admin/products/${row.$id}`)}
        >
          المكوّنات
        </Button>
      )}
    />
  )
}
