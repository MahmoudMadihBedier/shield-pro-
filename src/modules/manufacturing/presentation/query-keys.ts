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
  wasteReportBatches: (from: string, to: string) =>
    ['manufacturing', 'waste-report-batches', from, to] as const,
  /** `ids` must already be sorted+deduped by the caller for a stable cache key. */
  productsByIds: (ids: readonly string[]) => ['manufacturing', 'products-by-ids', ...ids] as const,
} as const
