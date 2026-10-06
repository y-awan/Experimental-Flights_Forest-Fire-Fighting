'use client'

import type L from 'leaflet'
import { memo, useMemo } from 'react'
import { Circle, Marker } from 'react-leaflet'
import { CRITICAL } from '@/lib/mission/glyph'
import type { Drone } from '@/lib/mission/types'
import { useDispatch } from '../../store'
import { cachedIcon, htmlIcon, useLatLng } from '../leaflet-utils'
import { detectionIcon, droneIcon } from '../icons'
import { useMapState } from '../map-state'

export const DetectionLayer = memo(function DetectionLayer() {
  const { detection, selection, hover } = useMapState()
  const dispatch = useDispatch()
  const selected = selection.type === 'detection' || hover === 'detection'
  const confirmed = detection.status === 'confirmed'
  const center = useLatLng(detection.pos)
  const areaStyle = useMemo<L.PathOptions>(
    () => ({ color: CRITICAL, weight: 1.5, dashArray: '3 3', fillColor: CRITICAL, fillOpacity: confirmed ? 0.3 : 0.18, interactive: false }),
    [confirmed],
  )
  const handlers = useMemo(
    () => ({
      click: () => dispatch({ type: 'select', selection: { type: 'detection' }, focus: false }),
      mouseover: () => dispatch({ type: 'hover', id: 'detection' }),
      mouseout: () => dispatch({ type: 'hover', id: null }),
    }),
    [dispatch],
  )
  const icon = detectionIcon(detection, selected)
  return (
    <>
      {detection.status !== 'dismissed' && <Circle center={center} radius={detection.uncertainty} pathOptions={areaStyle} />}
      <Marker position={center} icon={cachedIcon(icon.key, () => htmlIcon(icon.html))} title={`Detection ${detection.id}`} eventHandlers={handlers} zIndexOffset={500} />
    </>
  )
})

type DroneMarkerProps = { drone: Drone; index: number; elapsed: number; selected: boolean; hovered: boolean }

const DroneMarker = memo(function DroneMarker({ drone, index, elapsed, selected, hovered }: DroneMarkerProps) {
  const dispatch = useDispatch()
  const position = useLatLng(drone.reported.pos)
  const handlers = useMemo(
    () => ({
      click: () => dispatch({ type: 'select', selection: { type: 'drone', id: drone.id }, focus: false }),
      mouseover: () => dispatch({ type: 'hover', id: drone.id }),
      mouseout: () => dispatch({ type: 'hover', id: null }),
    }),
    [dispatch, drone.id],
  )
  const icon = droneIcon(drone, index, elapsed, selected, hovered)
  return (
    <Marker
      position={position}
      icon={cachedIcon(icon.key, () => htmlIcon(icon.html))}
      title={drone.name}
      zIndexOffset={selected ? 1000 : 600 + index}
      eventHandlers={handlers}
    />
  )
})

export const DroneLayer = memo(function DroneLayer() {
  const { drones, elapsed, selection, hover } = useMapState()
  return (
    <>
      {drones.map((d, i) => (
        <DroneMarker key={d.id} drone={d} index={i} elapsed={elapsed} selected={selection.type === 'drone' && selection.id === d.id} hovered={hover === d.id} />
      ))}
    </>
  )
})
