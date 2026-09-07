/**
 * Geolocation for the `sales` module — now a re-export of the app-wide
 * `@/core/geo` helpers (customer + warehouse records use the same format).
 *
 * `domain` is pure TypeScript — no framework imports.
 */
export { GEO_REGEX, parseGeo, isValidGeo, googleMapsUrl, type GeoPoint } from '@/core/geo'
