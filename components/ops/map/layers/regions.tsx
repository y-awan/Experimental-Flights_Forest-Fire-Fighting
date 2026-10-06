'use client'

import L from 'leaflet'
import { memo, useMemo } from 'react'
import { Marker, Polygon, Polyline } from 'react-leaflet'
import type { XY } from '@/lib/mission/geo'
import { PAPER, SELECT } from '@/lib/mission/glyph'
import { useDispatch } from '../../store'
import { cachedIcon, htmlIcon, useLatLng, useLatLngs } from '../leaflet-utils'
import { vertexIcon } from '../icons'
import { useMapState } from '../map-state'
import { CasedLine } from '../primitives'

const QUEUED_STYLE: L.PathOptions = { color: PAPER, weight: 1.5, dashArray: '6 4', fillOpacity: 0.04, interactive: false }
const CLOSING_STYLE: L.PathOptions = { color: SELECT, weight: 1.5, dashArray: '3 4', interactive: false }

const QueuedRegion = memo(function QueuedRegion({ points }: { points: XY[] }) {
  return <Polygon smoothFactor={0} positions={useLatLngs(points)} pathOptions={QUEUED_STYLE} />
})

const ActiveRegion = memo(function ActiveRegion({ points, emphasized }: { points: XY[]; emphasized: boolean }) {
  const dispatch = useDispatch()
  const positions = useLatLngs(points)
  const style = useMemo<L.PathOptions>(
    () => ({ color: SELECT, weight: emphasized ? 2.5 : 1.5, dashArray: '6 4', fillColor: SELECT, fillOpacity: 0.12 }),
    [emphasized],
  )
  const handlers = useMemo(() => ({ click: () => dispatch({ type: 'select', selection: { type: 'region' }, focus: false }) }), [dispatch])
  return <Polygon smoothFactor={0} positions={positions} pathOptions={style} eventHandlers={handlers} />
})

const Vertex = memo(function Vertex({ point, closing }: { point: XY; closing: boolean }) {
  const dispatch = useDispatch()
  const position = useLatLng(point)
  const handlers = useMemo<L.LeafletEventHandlerFnMap>(
    () =>
      closing
        ? {
            click: (e) => {
              L.DomEvent.stopPropagation(e)
              dispatch({ type: 'finishDraw' })
            },
          }
        : {},
    [closing, dispatch],
  )
  const icon = vertexIcon(closing)
  return <Marker position={position} icon={cachedIcon(icon.key, () => htmlIcon(icon.html))} eventHandlers={handlers} title={closing ? 'Close region' : undefined} />
})

const DraftRegion = memo(function DraftRegion({ points }: { points: XY[] }) {
  const positions = useLatLngs(points)
  const closing = useMemo(() => (positions.length > 2 ? [positions[positions.length - 1], positions[0]] : []), [positions])
  return (
    <>
      <CasedLine positions={positions} color={SELECT} weight={2} />
      {closing.length > 0 && <Polyline smoothFactor={0} positions={closing} pathOptions={CLOSING_STYLE} />}
      {points.map((p, i) => (
        <Vertex key={i} point={p} closing={i === 0 && points.length > 2} />
      ))}
    </>
  )
})

export const RegionLayer = memo(function RegionLayer() {
  const { draft, region, queuedRegions, selection } = useMapState()
  return (
    <>
      {queuedRegions.map((q, i) => (
        <QueuedRegion key={i} points={q} />
      ))}
      {region && <ActiveRegion points={region} emphasized={selection.type === 'region' || selection.type === 'proposal'} />}
      {draft.drawing && draft.points.length > 0 && <DraftRegion points={draft.points} />}
    </>
  )
})
