export type XY = { x: number; y: number }
export type LatLng = [number, number]

export const ORIGIN = { lat: 38.7468, lng: -120.4352 }
const M_PER_DEG_LAT = 111_320
const M_PER_DEG_LNG = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180)

export function toLatLng(p: XY): LatLng {
  return [ORIGIN.lat + p.y / M_PER_DEG_LAT, ORIGIN.lng + p.x / M_PER_DEG_LNG]
}

export function fromLatLng(lat: number, lng: number): XY {
  return { x: (lng - ORIGIN.lng) * M_PER_DEG_LNG, y: (lat - ORIGIN.lat) * M_PER_DEG_LAT }
}

export function dist(a: XY, b: XY) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function headingDeg(from: XY, to: XY) {
  const deg = (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI
  return (deg + 360) % 360
}

export function moveToward(from: XY, to: XY, step: number): { p: XY; arrived: boolean } {
  const d = dist(from, to)
  if (d <= step || d === 0) return { p: { ...to }, arrived: true }
  const k = step / d
  return { p: { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }, arrived: false }
}

export function pathLength(path: XY[]) {
  let total = 0
  for (let i = 1; i < path.length; i++) total += dist(path[i - 1], path[i])
  return total
}

export function pointAlong(path: XY[], s: number): { p: XY; heading: number; index: number } {
  let remaining = Math.max(0, s)
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i])
    if (remaining <= seg) {
      const k = seg === 0 ? 0 : remaining / seg
      return {
        p: {
          x: path[i - 1].x + (path[i].x - path[i - 1].x) * k,
          y: path[i - 1].y + (path[i].y - path[i - 1].y) * k,
        },
        heading: headingDeg(path[i - 1], path[i]),
        index: i,
      }
    }
    remaining -= seg
  }
  const last = path[path.length - 1]
  return { p: { ...last }, heading: headingDeg(path[path.length - 2], last), index: path.length - 1 }
}

export function splitPath(path: XY[], s: number): { done: XY[]; ahead: XY[] } {
  const { p, index } = pointAlong(path, s)
  return { done: [...path.slice(0, index), p], ahead: [p, ...path.slice(index)] }
}

function verticalSpan(poly: XY[], x: number): [number, number] | null {
  const ys: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) {
      const t = (x - a.x) / (b.x - a.x)
      ys.push(a.y + (b.y - a.y) * t)
    }
  }
  if (ys.length < 2) return null
  return [Math.min(...ys), Math.max(...ys)]
}

export function lawnmower(poly: XY[], spacing: number, inset: number): XY[] {
  const xs = poly.map((p) => p.x)
  const minX = Math.min(...xs) + inset
  const maxX = Math.max(...xs) - inset
  const path: XY[] = []
  let up = true
  for (let x = minX; x <= maxX + 0.01; x += spacing) {
    const span = verticalSpan(poly, x)
    if (!span) continue
    const lo = span[0] + inset
    const hi = span[1] - inset
    if (hi - lo < 20) continue
    if (up) path.push({ x, y: lo }, { x, y: hi })
    else path.push({ x, y: hi }, { x, y: lo })
    up = !up
  }
  return path
}

export function polygonArea(poly: XY[]) {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]
    const q = poly[(i + 1) % poly.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

export function polygonPerimeter(poly: XY[]) {
  return pathLength([...poly, poly[0]])
}

export function centroid(poly: XY[]): XY {
  const n = poly.length
  return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n }
}

export function formatCoord(p: XY) {
  const [lat, lng] = toLatLng(p)
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
}

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
