import { BOUNDARY, HOME, SECTORS } from './data'
import { droneHealth, nextWaypoint, sectorOwner, sectorPct, shortActivity } from './derive'
import { dist, splitPath, toLatLng, type XY } from './geo'
import { INK, PAPER } from './glyph'
import type { MissionState } from './sim'
import type { SectorId } from './types'

export type LngLat = [number, number]
type Geometry =
  | { type: 'Point'; coordinates: LngLat }
  | { type: 'LineString'; coordinates: LngLat[] }
  | { type: 'Polygon'; coordinates: LngLat[][] }
export type Feat = { type: 'Feature'; geometry: Geometry; properties: Record<string, string | number | boolean> }
export type FC = { type: 'FeatureCollection'; features: Feat[] }

const SECTOR_IDS: SectorId[] = ['A', 'B', 'C']
const DECLUTTER_RADIUS = 650

export const lnglat = (p: XY): LngLat => {
  const [lat, lng] = toLatLng(p)
  return [lng, lat]
}
const ring = (pts: XY[]): LngLat[] => [...pts.map(lnglat), lnglat(pts[0])]
const fc = (features: Feat[]): FC => ({ type: 'FeatureCollection', features })
const point = (p: XY, properties: Feat['properties']): Feat => ({ type: 'Feature', geometry: { type: 'Point', coordinates: lnglat(p) }, properties })
const line = (pts: XY[], properties: Feat['properties']): Feat => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts.map(lnglat) }, properties })
const polygon = (pts: XY[], properties: Feat['properties']): Feat => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring(pts)] }, properties })

function circle(center: XY, radius: number, steps = 64): XY[] {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2
    return { x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius }
  })
}

export function missionBounds(): [LngLat, LngLat] {
  const pts = [...BOUNDARY, HOME].map(lnglat)
  const lngs = pts.map((p) => p[0])
  const lats = pts.map((p) => p[1])
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

export function boundsOf(points: XY[]): [LngLat, LngLat] {
  const pts = points.map(lnglat)
  const lngs = pts.map((p) => p[0])
  const lats = pts.map((p) => p[1])
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

export function boundaryFC(): FC {
  return fc([polygon(BOUNDARY, {})])
}

function selectedDroneId(state: MissionState) {
  return state.selection.type === 'drone' ? state.selection.id : null
}

export function sectorsFC(state: MissionState): FC {
  const sel = selectedDroneId(state)
  return fc(
    SECTOR_IDS.map((id) => {
      const owner = sectorOwner(id, state.drones)
      return polygon(SECTORS[id].polygon, {
        id,
        owned: !!sel && owner?.drone.id === sel,
        selected: state.selection.type === 'sector' && state.selection.id === id,
        hovered: state.hover === `sector:${id}`,
      })
    }),
  )
}

export function lanesFC(state: MissionState): FC {
  const sel = selectedDroneId(state)
  const out: Feat[] = []
  for (const id of SECTOR_IDS) {
    const { done, ahead } = splitPath(SECTORS[id].path, state.progress[id])
    const owner = sectorOwner(id, state.drones)
    const owned = (!!sel && owner?.drone.id === sel) || (state.selection.type === 'sector' && state.selection.id === id)
    if (state.layers.completed && done.length > 1) out.push(line(done, { kind: 'done', owned, sector: id }))
    if (state.layers.planned && ahead.length > 1) out.push(line(ahead, { kind: 'planned', owned, sector: id }))
  }
  return fc(out)
}

export function trailsFC(state: MissionState): FC {
  if (!state.layers.trails) return fc([])
  return fc(
    state.drones
      .filter((d) => d.trail.length > 1)
      .map((d) => line([...d.trail, d.reported.pos], { id: d.id, selected: selectedDroneId(state) === d.id })),
  )
}

export function routesFC(state: MissionState): FC {
  const sel = selectedDroneId(state)
  const out: Feat[] = []
  for (const d of state.drones) {
    const mode = d.reported.mode
    let target: XY | null = null
    if (mode === 'rth') target = HOME
    if (mode === 'investigate') target = state.detection.pos
    if (!target || dist(d.reported.pos, target) < 30) continue
    const next = nextWaypoint(d, state.progress, state.detection)
    const eta = next ? formatEta(next.eta) : ''
    out.push(
      line([d.reported.pos, target], {
        id: d.id,
        selected: sel === d.id,
        kind: mode,
        label: mode === 'rth' ? `${d.short} → LZ-1 · ${eta}` : `${d.short} → ${state.detection.id} · ${eta}`,
        sort: sel === d.id ? 1 : 20,
      }),
    )
  }
  return fc(out)
}

function formatEta(seconds: number) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function detectionAreaFC(state: MissionState): FC {
  const det = state.detection
  if (det.status === 'dismissed') return fc([])
  return fc([polygon(circle(det.pos, Math.max(4, det.uncertainty)), { status: det.status, selected: state.selection.type === 'detection' })])
}

export function regionsFC(state: MissionState): FC {
  const out: Feat[] = state.queuedRegions.filter((r) => r.length > 2).map((r) => polygon(r, { kind: 'queued' }))
  if (state.region && state.region.length > 2) out.push(polygon(state.region, { kind: 'active', selected: state.selection.type === 'region' }))
  return fc(out)
}

export function draftFC(state: MissionState, cursor: XY | null): FC {
  const pts = state.draft.points
  if (!state.draft.drawing) return fc([])
  const out: Feat[] = []
  if (pts.length > 1) out.push(line(pts, { kind: 'edge' }))
  if (pts.length && cursor) out.push(line([pts[pts.length - 1], cursor], { kind: 'preview' }))
  if (pts.length > 2 && cursor) out.push(line([cursor, pts[0]], { kind: 'closing' }))
  pts.forEach((p, i) => out.push(point(p, { kind: 'vertex', first: i === 0 && pts.length > 2 })))
  return fc(out)
}

export function markersFC(state: MissionState): FC {
  const det = state.detection
  const detSelected = state.selection.type === 'detection'
  return fc([
    point(HOME, { icon: 'home', target: 'home', sort: 2 }),
    point(det.pos, { icon: `det-${det.status}-${detSelected || state.hover === 'detection' ? 1 : 0}`, target: 'detection', sort: 1 }),
  ])
}

export function dronesFC(state: MissionState): FC {
  const sel = selectedDroneId(state)
  return fc(
    state.drones.map((d, i) => {
      const h = droneHealth(d, state.elapsed, i)
      const selected = sel === d.id || state.hover === d.id
      return point(d.reported.pos, {
        target: `drone:${d.id}`,
        icon: `drone-${d.id}-${h.level}-${h.stale ? 1 : 0}-${selected ? 1 : 0}`,
        pointer: h.stale ? 'ptr-stale' : 'ptr',
        heading: d.reported.heading,
        showPointer: h.airborne,
        sort: sel === d.id ? 10 : h.level === 'critical' ? 5 : 1,
      })
    }),
  )
}

type Chip = 'chip' | 'chip-select' | 'chip-caution' | 'chip-critical' | 'chip-stale' | 'chip-fire' | 'chip-muted'

/**
 * Builds every map label. Priority (`sort`, lower wins collisions) favours the selection,
 * then critical/caution states. Labels near the current focus collapse to a short form so
 * the selected object's expanded label has room.
 */
export function labelsFC(state: MissionState): FC {
  const sel = selectedDroneId(state)
  const det = state.detection
  const detSelected = state.selection.type === 'detection'
  const selDrone = sel ? state.drones.find((d) => d.id === sel) : null
  const focus: XY | null = selDrone ? selDrone.reported.pos : detSelected ? det.pos : null
  const nearFocus = (p: XY) => !!focus && dist(p, focus) < DECLUTTER_RADIUS
  const out: Feat[] = []

  state.drones.forEach((d, i) => {
    const h = droneHealth(d, state.elapsed, i)
    const r = d.reported
    const selected = sel === d.id
    const hovered = state.hover === d.id
    const reduced = !selected && !hovered && nearFocus(r.pos)
    const staleText = h.linkLost ? `LINK LOST · ${Math.floor(h.age)} s` : `LAST KNOWN · ${Math.floor(h.age)} s`
    let text: string
    if (selected || hovered) {
      const first = `${d.name} · ${shortActivity(d, state.progress)}`
      const second = h.stale
        ? `${staleText} · ${Math.round(r.battery)}%`
        : `${Math.round(r.altitude)} m · ${Math.round(r.battery)}% · ${Math.round(r.groundspeed)} m/s`
      text = `${first}\n${second}`
    } else if (reduced) {
      text = h.level === 'critical' || h.stale ? `${d.short} !` : d.short
    } else if (h.stale) {
      text = `${d.short} · ${staleText}`
    } else if (h.level !== 'nominal') {
      text = `${d.short} · ${Math.round(r.battery)}% · ${shortActivity(d, state.progress)}`
    } else {
      text = `${d.short} · ${Math.round(r.altitude)} m · ${shortActivity(d, state.progress)}`
    }
    let chip: Chip = 'chip'
    if (h.level === 'caution') chip = 'chip-caution'
    if (h.stale) chip = 'chip-stale'
    if (h.level === 'critical') chip = 'chip-critical'
    if ((selected || hovered) && h.level !== 'critical') chip = 'chip-select'
    out.push(
      point(r.pos, {
        target: `drone:${d.id}`,
        text,
        chip,
        color: chip === 'chip-critical' ? INK : PAPER,
        sort: selected ? 0 : hovered ? 1 : h.level === 'critical' ? 3 : h.level === 'caution' || h.stale ? 4 : reduced ? 9 : 6,
      }),
    )
  })

  if (det.status !== 'dismissed' || detSelected) {
    const conf = `${Math.round(det.confidence * 100)}%`
    const inv = state.drones.find((d) => d.id === det.investigator)
    const onScene = inv?.reported.mode === 'orbit'
    let text: string
    if (detSelected || state.hover === 'detection') {
      const head = det.status === 'confirmed' ? `FIRE CONFIRMED · ${det.id}` : det.status === 'dismissed' ? `${det.id} · dismissed` : `POSSIBLE FIRE · ${det.id}`
      text = `${head}\n${conf} · ±${Math.round(det.uncertainty)} m${inv ? ` · ${inv.short} ${onScene ? 'on scene' : 'en route'}` : ''}`
    } else if (sel && nearFocus(det.pos)) {
      text = det.status === 'confirmed' ? 'FIRE' : 'FIRE?'
    } else {
      text = det.status === 'confirmed' ? `FIRE CONFIRMED · ${conf}` : `POSSIBLE FIRE · ${conf}`
    }
    const chip: Chip = detSelected ? 'chip-select' : det.status === 'confirmed' ? 'chip-critical' : det.status === 'dismissed' ? 'chip-muted' : 'chip-fire'
    out.push(
      point(det.pos, {
        target: 'detection',
        text,
        chip,
        color: chip === 'chip-critical' ? INK : chip === 'chip-fire' ? '#ffb4ad' : PAPER,
        sort: detSelected ? 0 : det.status === 'unreviewed' ? 2 : 5,
      }),
    )
  }

  out.push(
    point(HOME, {
      target: 'home',
      text: nearFocus(HOME) ? 'LZ-1' : 'LZ-1 · Ridge Road',
      chip: 'chip-muted',
      color: PAPER,
      sort: 8,
    }),
  )
  return fc(out)
}

export function sectorLabelsFC(state: MissionState): FC {
  if (!state.layers.sectors) return fc([])
  return fc(
    SECTOR_IDS.map((id) => {
      const poly = SECTORS[id].polygon
      const top = poly.reduce((a, b) => (b.y > a.y ? b : a))
      const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length
      const selected = state.selection.type === 'sector' && state.selection.id === id
      return point(
        { x: cx, y: top.y - 40 },
        {
          target: `sector:${id}`,
          text: `SECTOR ${id} · ${Math.round(sectorPct(id, state.progress) * 100)}%`,
          chip: selected ? 'chip-select' : 'chip-muted',
          color: PAPER,
          sort: selected ? 0 : 12,
        },
      )
    }),
  )
}
