'use client'

import type L from 'leaflet'
import { memo, useMemo } from 'react'
import { Marker, Polygon } from 'react-leaflet'
import { SECTORS } from '@/lib/mission/data'
import { sectorPct } from '@/lib/mission/derive'
import { centroid, splitPath } from '@/lib/mission/geo'
import { INK, SELECT } from '@/lib/mission/glyph'
import type { MapLayers, SectorId } from '@/lib/mission/types'
import { useDispatch } from '../../store'
import { cachedIcon, htmlIcon, ll, useLatLngs } from '../leaflet-utils'
import { sectorLabel } from '../icons'
import { useMapState } from '../map-state'
import { CasedLine } from '../primitives'

const SECTOR_IDS = Object.keys(SECTORS) as SectorId[]

type SectorProps = { id: SectorId; distance: number; pct: number; owned: boolean; layers: MapLayers }

const Sector = memo(function Sector({ id, distance, pct, owned, layers }: SectorProps) {
  const dispatch = useDispatch()
  const s = SECTORS[id]
  const polygon = useLatLngs(s.polygon)
  const { done, ahead } = useMemo(() => splitPath(s.path, distance), [s.path, distance])
  const donePts = useLatLngs(done)
  const aheadPts = useLatLngs(ahead)
  const labelPos = useMemo(() => {
    const c = centroid(s.polygon)
    const top = s.polygon.reduce((a, b) => (b.y > a.y ? b : a))
    return ll({ x: c.x, y: top.y - 60 })
  }, [s.polygon])
  const areaStyle = useMemo<L.PathOptions>(
    () => ({
      color: owned ? SELECT : INK,
      weight: owned ? 2 : 1,
      opacity: owned ? 0.9 : 0.55,
      dashArray: '2 5',
      fillColor: owned ? SELECT : INK,
      fillOpacity: owned ? 0.1 : 0.04,
      interactive: false,
    }),
    [owned],
  )
  const handlers = useMemo(() => ({ click: () => dispatch({ type: 'focus', focus: { kind: 'bounds', points: s.polygon } }) }), [dispatch, s.polygon])
  const label = sectorLabel(id, pct, owned)
  const lineColor = owned ? SELECT : INK

  return (
    <>
      {layers.sectors && <Polygon smoothFactor={0} positions={polygon} pathOptions={areaStyle} />}
      {layers.planned && <CasedLine positions={aheadPts} color={lineColor} weight={1.25} dash="3 5" opacity={0.75} />}
      {layers.completed && <CasedLine positions={donePts} color={lineColor} weight={3} opacity={0.9} />}
      {layers.sectors && (
        <Marker position={labelPos} icon={cachedIcon(label.key, () => htmlIcon(label.html, [0, 9]))} eventHandlers={handlers} keyboard={false} />
      )}
    </>
  )
})

export const SectorLayer = memo(function SectorLayer() {
  const { progress, layers, selection, drones } = useMapState()
  const selDrone = selection.type === 'drone' ? drones.find((d) => d.id === selection.id) : null
  return (
    <>
      {SECTOR_IDS.map((id) => (
        <Sector
          key={id}
          id={id}
          distance={progress[id]}
          pct={Math.round(sectorPct(id, progress) * 100)}
          owned={!!selDrone?.assignments.includes(id)}
          layers={layers}
        />
      ))}
    </>
  )
})
