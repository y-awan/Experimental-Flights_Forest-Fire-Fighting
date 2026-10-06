import L from 'leaflet'
import { useMemo } from 'react'
import { toLatLng, type XY } from '@/lib/mission/geo'

/** Mission-local metres (XY) → Leaflet [lat, lng]. */
export function ll(p: XY): L.LatLngTuple {
  return toLatLng(p) as L.LatLngTuple
}

/** Stable LatLng for a point; only changes identity when the coordinates change. */
export function useLatLng(p: XY): L.LatLngTuple {
  return useMemo(() => ll(p), [p.x, p.y])
}

/**
 * Stable LatLng array for a path. Keyed on the array reference, so pass static arrays
 * or memoized results. react-leaflet redraws a path whenever `positions` changes identity.
 */
export function useLatLngs(points: XY[] | null | undefined, closed = false): L.LatLngTuple[] {
  return useMemo(() => {
    if (!points?.length) return []
    return (closed ? [...points, points[0]] : points).map(ll)
  }, [points, closed])
}

const iconCache = new Map<string, L.DivIcon>()

/** Reuses DivIcon instances by key so markers are only re-iconed when their visual state changes. */
export function cachedIcon(key: string, build: () => L.DivIcon) {
  let icon = iconCache.get(key)
  if (!icon) {
    icon = build()
    iconCache.set(key, icon)
    if (iconCache.size > 600) iconCache.delete(iconCache.keys().next().value as string)
  }
  return icon
}

export function htmlIcon(html: string, anchor?: [number, number]) {
  return L.divIcon({ className: 'ops-icon', html, iconSize: [0, 0], iconAnchor: anchor })
}
