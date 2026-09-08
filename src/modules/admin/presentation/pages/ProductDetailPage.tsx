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
import { parseSaleUnits, UNIT_OPTIONS, unitShort, type SaleUnit } from '@/core/uom'
import { formatNumber } from '@/shared/formatters'
import { Button, Card, PageHeader } from '@/shared/ui'

import { productBomRepo, productsRepo, rawMaterialsRepo } from '../../data/repos'
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

  const rawMaterialUnits = useQuery<Map<string, string>, AppError>({
    queryKey: ['admin', 'raw-material-units'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await rawMaterialsRepo.list({
        page: 0,
        pageSize: 200,
        sort: { field: 'name', dir: 'asc' },
      })
      if (isErr(res)) throw res.error
      return new Map(res.value.rows.map((rm) => [rm.$id, rm.uom]))
    },
  })
  const rawUnit = (id: string) => unitShort(rawMaterialUnits.data?.get(id))
  const productUnit = unitShort(productQuery.data?.uom)

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
        <Card className="text-sm text-red-600 dark:text-red-400">{productQuery.error.message}</Card>
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
                    {rawUnit(line.raw_material_id) ? (
                      <span className="ms-1 text-zinc-400">{rawUnit(line.raw_material_id)}</span>
                    ) : null}
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
          <h3 className="mb-1 text-sm font-semibold">
            الاحتياج لكل وحدة إنتاج{productUnit ? ` (لكل 1 ${productUnit})` : ''}
          </h3>
          <p className="mb-2 text-xs text-zinc-500">
            الكميات بوحدة قياس كل خامة. عند إنتاج كمية ما تُضرب هذه القيم في عدد الوحدات المنتجة
            لخصمها من المخزون.
          </p>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {demandPerUnit.map((demand) => (
              <li key={demand.rawMaterialId} className="flex justify-between">
                <span>{rawMaterialLabel(demand.rawMaterialId)}</span>
                <span dir="ltr">
                  {formatNumber(demand.qty)}
                  {rawUnit(demand.rawMaterialId) ? (
                    <span className="ms-1 text-zinc-400">{rawUnit(demand.rawMaterialId)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {productQuery.data ? (
        <SaleUnitsCard
          product={productQuery.data}
          canWrite={canWrite}
          onSaved={() =>
            void queryClient.invalidateQueries({
              queryKey: queryKeys.admin.detail('product', productId),
            })
          }
        />
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

/**
 * Manage a product's alternate selling units (`products.sale_units`). The
 * product's own `uom` is always the implicit factor-1 base unit and is not
 * listed here. `factor` = how many stock units make one of this sale unit.
 */
function SaleUnitsCard({
  product,
  canWrite,
  onSaved,
}: {
  product: Product
  canWrite: boolean
  onSaved: () => void
}) {
  const [rows, setRows] = useState<SaleUnit[]>(() => parseSaleUnits(product.sale_units))
  const [dirty, setDirty] = useState(false)

  const mutation = useMutation<unknown, AppError, void>({
    mutationFn: async () => {
      const res = await productsRepo.setSaleUnits(
        product.$id,
        rows.filter((r) => r.unit && r.factor > 0),
      )
      if (isErr(res)) throw res.error
    },
    onSuccess: () => {
      setDirty(false)
      onSaved()
    },
  })

  const patch = (i: number, next: Partial<SaleUnit>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...next } : r)))
    setDirty(true)
  }
  const add = () => {
    setRows((prev) => [...prev, { unit: 'carton', factor: 12, label: '' }])
    setDirty(true)
  }
  const remove = (i: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
    setDirty(true)
  }

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">وحدات البيع / Sale units</h3>
        <p className="mt-1 text-xs text-zinc-500">
          وحدة المخزون ({unitShort(product.uom)}) متاحة دائمًا. أضف هنا وحدات بيع بديلة — المعامل هو
          عدد وحدات المخزون في الوحدة الواحدة (مثال: كرتونة = 12).
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">لا توجد وحدات بيع بديلة.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-zinc-500">
                الوحدة
                <select
                  disabled={!canWrite}
                  value={row.unit}
                  onChange={(e) => patch(i, { unit: e.target.value as SaleUnit['unit'] })}
                  className="block w-32 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                >
                  {UNIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-zinc-500">
                المعامل / Factor
                <input
                  type="number"
                  dir="ltr"
                  min={0}
                  step="any"
                  disabled={!canWrite}
                  value={Number.isFinite(row.factor) ? row.factor : ''}
                  onChange={(e) => patch(i, { factor: e.target.valueAsNumber })}
                  className="block w-24 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex-1 text-xs text-zinc-500">
                مسمى (اختياري)
                <input
                  type="text"
                  disabled={!canWrite}
                  value={row.label ?? ''}
                  onChange={(e) => patch(i, { label: e.target.value })}
                  placeholder={unitShort(row.unit)}
                  className="block w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                />
              </label>
              {canWrite ? (
                <Button size="sm" variant="danger" onClick={() => remove(i)}>
                  حذف
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={add}>
            + وحدة بيع
          </Button>
          <Button
            size="sm"
            disabled={!dirty || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'جارٍ الحفظ…' : 'حفظ'}
          </Button>
          {mutation.isError ? (
            <span role="alert" className="text-xs text-red-600 dark:text-red-400">
              {mutation.error.message}
            </span>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}
