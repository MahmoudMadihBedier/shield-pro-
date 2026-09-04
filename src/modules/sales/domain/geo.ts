/**
 * Geolocation parsing for the `sales` module. A sales invoice carries the rep's
 * device location, locked at issue time (`"lat,lng"` — two comma-separated
 * floats) and is mandatory before the invoice can be issued.
 *
 * `GEO_REGEX` is the same pattern the `admin` module validates customer `geo`
 * with. It is defined locally (and re-exported from `./schemas`) rather than
 * imported from `@/modules/admin`, because the admin barrel pulls React +
 * Appwrite and the domain layer must stay framework-free (`claude.md` B.4).
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import { GEO_REGEX } from './schemas'

export { GEO_REGEX }

export interface GeoPoint {
  lat: number
  lng: number
}

/** `true` when `raw` is a well-formed `"lat,lng"` pair in valid ranges. */
export function isValidGeo(raw: string | null | undefined): boolean {
  return parseGeo(raw) !== null
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
