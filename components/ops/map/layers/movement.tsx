'use client'

import type L from 'leaflet'
import { memo, useMemo } from 'react'
import { Marker, Polyline } from 'react-leaflet'
import { HOME } from '@/lib/mission/data'
import { nextWaypoint } from '@/lib/mission/derive'
import type { XY } from '@/lib/mission/geo'
import { INK, PAPER, SELECT } from '@/lib/mission/glyph'
import type { Drone } from '@/lib/mission/types'
import { fmtDuration } from '../../format'
import { cachedIcon, htmlIcon, useLatLng, useLatLngs } from '../leaflet-utils'
import { routeLabel } from '../icons'
import { useMapState } from '../map-state'
import { CasedLine } from '../primitives'

const TRAIL_STYLE: L.PathOptions = { color: PAPER, weight: 2, opacity: 0.85, dashArray: '1 4', lineCap: 'round', interactive: false }

const Trail = memo(function Trail({ trail }: { trail: XY[] }) {
  const positions = useLatLngs(trail)
  if (positions.length < 2) return null
  return <Polyline positions={positions} pathOptions={TRAIL_STYLE} />
})

export const TrailLayer = memo(function TrailLayer() {
  const { drones, layers } = useMapState()
  if (!layers.trails) return null
  return (
    <>
      {drones.map((d) => (
        <Trail key={d.id} trail={d.trail} />
      ))}
    </>
  )
})

type RouteProps = { drone: Drone; to: XY; label: string; selected: boolean }

const Route = memo(function Route({ drone, to, label, selected }: RouteProps) {
  const from = drone.reported.pos
  const line = useMemo(() => [from, to], [from.x, from.y, to.x, to.y])
  const positions = useLatLngs(line)
  const mid = useLatLng({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 })
  const chip = routeLabel(drone.id, label, selected)
  return (
    <>
      <CasedLine positions={positions} color={selected ? SELECT : INK} weight={2} dash="7 5" />
      {label && <Marker position={mid} interactive={false} keyboard={false} icon={cachedIcon(chip.key, () => htmlIcon(chip.html, [0, 0]))} />}
    </>
  )
})

/** Direct-to lines for drones flying somewhere other than their survey path (RTH, investigate). */
export const RouteLayer = memo(function RouteLayer() {
  const { drones, detection, progress, selection } = useMapState()
  return (
    <>
      {drones.map((d) => {
        const mode = d.reported.mode
        const to = mode === 'rth' ? HOME : mode === 'investigate' ? detection.pos : null
        if (!to) return null
        const next = nextWaypoint(d, progress, detection)
        const target = mode === 'rth' ? 'LZ-1' : detection.id
        const label = next ? `${d.short} → ${target} · ${fmtDuration(next.eta)}` : ''
        return <Route key={d.id} drone={d} to={to} label={label} selected={selection.type === 'drone' && selection.id === d.id} />
      })}
    </>
  )
})
