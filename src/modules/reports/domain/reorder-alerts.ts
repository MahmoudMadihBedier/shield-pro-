/**
 * Reorder-point alerts — raw materials whose on-hand quantity has dropped
 * below `raw_materials.reorder_point`.
 *
 * Pure TypeScript, zero I/O (`claude.md` B.4).
 */

export interface ReorderAlert {
  rawMaterialId: string
  onHand: number
  reorderPoint: number
  shortfall: number
}

export interface RawMaterialLike {
  $id: string
  reorder_point: number
}

/**
 * Only raw materials with `onHand < reorderPoint` are alerts — a material
 * exactly at its reorder point is not (yet) short, it is the trigger to
 * reorder next, not proof stock already ran out. Sorted by largest shortfall
 * (reorderPoint - onHand) first, since that is the most urgent gap to close.
 * A material with no `bin_balances` row at all is treated as `onHand: 0`.
 */
export function reorderAlerts(
  rawMaterials: readonly RawMaterialLike[],
  onHandByMaterial: ReadonlyMap<string, number>,
): ReorderAlert[] {
  const alerts: ReorderAlert[] = []
  for (const material of rawMaterials) {
    const onHand = onHandByMaterial.get(material.$id) ?? 0
    if (onHand < material.reorder_point) {
      alerts.push({
        rawMaterialId: material.$id,
        onHand,
        reorderPoint: material.reorder_point,
        shortfall: material.reorder_point - onHand,
      })
    }
  }
  return alerts.sort((a, b) => b.shortfall - a.shortfall)
}
