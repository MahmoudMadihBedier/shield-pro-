/**
 * Local TanStack Query keys for the `manufacturing` module's own auxiliary
 * reads (product options, per-product BOM, factory warehouses). The two
 * submittable-document lists use the shared `queryKeys.documents.*` factory via
 * `@/shared/documents` — those are not duplicated here, and
 * `src/application/query/keys.ts` is not edited.
 */
export const manufacturingKeys = {
  root: () => ['manufacturing'] as const,
  productOptions: () => ['manufacturing', 'product-options'] as const,
  productBom: (productId: string) => ['manufacturing', 'product-bom', productId] as const,
  warehouses: () => ['manufacturing', 'warehouses'] as const,
} as const
