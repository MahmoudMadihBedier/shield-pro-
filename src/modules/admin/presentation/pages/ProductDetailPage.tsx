/**
 * Manage one product's bill of materials (`product_bom` lines). Add / remove
 * raw-material + qty-per-unit rows; everything else about the product is edited
 * from the products list.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { queryKeys } from '@/application/query/keys'
import { useAuth } from '@/application/auth/context'
import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import { isSystemAdmin } from '@/core/rbac'
import { formatNumber } from '@/shared/formatters'
import { Button, Card, PageHeader } from '@/shared/ui'

import { productBomRepo, productsRepo } from '../../data/repos'
import { explodeBom } from '../../domain/bom'
import { FIELD_LABELS, bilingual, type Label } from '../../domain/labels'
import type { Product, ProductBomLine } from '../../domain/schemas'
import { EntityDialog } from '../components/EntityDialog'
import { MasterFormPanel } from '../components/MasterFormPanel'
import { useRelationOptions } from '../hooks/useRelationOptions'

export function ProductDetailPage() {
  const { id: productId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { principal } = useAuth()
  const canWrite = principal != null && isSystemAdmin(principal)
  const [adding, setAdding] = useState(false)

  const productQuery = useQuery<Product, AppError>({
    queryKey: queryKeys.admin.detail('product', productId),
    enabled: productId !== '',
    queryFn: async () => {
      const result = await productsRepo.get(productId)
      if (isErr(result)) throw result.error
      return result.value
    },
  })

  const bomQuery = useQuery<ProductBomLine[], AppError>({
    queryKey: queryKeys.admin.list('productBom', { productId }),
    enabled: productId !== '',
    queryFn: async () => {
      const result = await productBomRepo.listForProduct(productId)
      if (isErr(result)) throw result.error
      return result.value.rows
    },
  })

  const rawMaterials = useRelationOptions('rawMaterial')
  const rawMaterialLabel = useMemo(() => {
    const map = new Map((rawMaterials.data ?? []).map((option) => [option.value, option.label]))
    return (rawMaterialId: string) => map.get(rawMaterialId) ?? rawMaterialId
  }, [rawMaterials.data])

  const removeMutation = useMutation<void, AppError, string>({
    mutationFn: async (lineId) => {
      const result = await productBomRepo.remove(lineId)
      if (isErr(result)) throw result.error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'list', 'productBom'] })
    },
  })

  const lines = bomQuery.data ?? []
  const demandPerUnit = explodeBom(lines, 1)

  const fallbackLabel: Label = { ar: '', en: '' }
  const rawMaterialColLabel = FIELD_LABELS.productBom.raw_material_id ?? fallbackLabel
  const qtyColLabel = FIELD_LABELS.productBom.qty_per_unit ?? fallbackLabel

  return (
    <div className="space-y-4">
      <PageHeader
        title={`قائمة مواد المنتج${productQuery.data ? ` — ${productQuery.data.name}` : ''}`}
        titleEn="Product bill of materials"
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/admin/products')}>
              رجوع
            </Button>
            {canWrite ? <Button onClick={() => setAdding(true)}>+ مكوّن</Button> : null}
          </div>
        }
      />

      {productQuery.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">
          {productQuery.error.message}
        </Card>
      ) : null}

      <Card className="p-0">
        <table className="w-full text-start text-sm">
          <thead className="bg-black/[0.02] text-xs text-zinc-500 dark:bg-white/[0.03]">
            <tr>
              <th className="p-3 text-start font-semibold">{bilingual(rawMaterialColLabel)}</th>
              <th className="p-3 text-end font-semibold">{bilingual(qtyColLabel)}</th>
              {canWrite ? <th className="p-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {bomQuery.isLoading ? (
              <tr>
                <td colSpan={3} className="p-6 text-center text-zinc-500">
                  جارٍ التحميل…
                </td>
              </tr>
            ) : bomQuery.isError ? (
              <tr>
                <td colSpan={3} className="p-6 text-center text-red-600 dark:text-red-400">
                  {bomQuery.error.message}
                </td>
              </tr>
            ) : lines.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-6 text-center text-zinc-500">
                  لا توجد مكوّنات بعد
                </td>
              </tr>
            ) : (
              lines.map((line) => (
                <tr key={line.$id} className="border-t border-black/5 dark:border-white/5">
                  <td className="p-3">{rawMaterialLabel(line.raw_material_id)}</td>
                  <td className="p-3 text-end" dir="ltr">
                    {formatNumber(line.qty_per_unit)}
                  </td>
                  {canWrite ? (
                    <td className="p-3 text-end">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(line.$id)}
                      >
                        حذف
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {lines.length > 0 ? (
        <Card>
          <h3 className="mb-2 text-sm font-semibold">الاحتياج لكل وحدة إنتاج</h3>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {demandPerUnit.map((demand) => (
              <li key={demand.rawMaterialId} className="flex justify-between">
                <span>{rawMaterialLabel(demand.rawMaterialId)}</span>
                <span dir="ltr">{formatNumber(demand.qty)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <EntityDialog
        open={adding}
        title="إضافة مكوّن"
        titleEn="Add BOM line"
        onClose={() => setAdding(false)}
      >
        <MasterFormPanel
          entity="productBom"
          mode="create"
          fixedValues={{ product_id: productId }}
          onDone={() => {
            setAdding(false)
            void queryClient.invalidateQueries({ queryKey: ['admin', 'list', 'productBom'] })
          }}
        />
      </EntityDialog>
    </div>
  )
}
