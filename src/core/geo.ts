/**
 * `"lat,lng"` geolocation parsing — shared by sales invoices (rep location at
 * issue time), customer records and warehouses. Two comma-separated decimals.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

export const GEO_REGEX = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/

export interface GeoPoint {
  lat: number
  lng: number
}

/**
 * Parse `"lat,lng"` into `{ lat, lng }`, or `null` when malformed or out of
 * range (`lat ∈ [-90, 90]`, `lng ∈ [-180, 180]`).
 */
export function parseGeo(raw: string | null | undefined): GeoPoint | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!GEO_REGEX.test(trimmed)) return null
  const [latStr, lngStr] = trimmed.split(',')
  const lat = Number(latStr)
  const lng = Number(lngStr)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/** `true` when `raw` is a well-formed `"lat,lng"` pair in valid ranges. */
export function isValidGeo(raw: string | null | undefined): boolean {
  return parseGeo(raw) !== null
}

/** A Google Maps link for a valid `"lat,lng"` string, or `null`. */
export function googleMapsUrl(raw: string | null | undefined): string | null {
  const p = parseGeo(raw)
  return p ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : null
}
