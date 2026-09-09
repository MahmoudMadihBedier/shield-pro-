/**
 * Money rounding — the single place a monetary figure is snapped to whole
 * cents. Half-up to two decimals with an `Number.EPSILON` nudge so binary
 * float drift (`0.1 + 0.2`, an interest split, a running balance) never
 * surfaces as a stray fraction of a cent or paints a settled account red.
 *
 * `core` is framework-free — plain TypeScript only. Formatting for display
 * lives in `src/shared/formatters`; this is the arithmetic primitive the
 * domain layer rounds with.
 */

/** Round `value` to 2 decimal places (whole cents), half up (toward +∞). */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) return value
  const scaled = (value + Number.EPSILON) * 100
  const rounded = Math.round(scaled) / 100
  // Collapse a `-0` result (e.g. from a tiny negative sliver) to plain `0`.
  return rounded === 0 ? 0 : rounded
}
