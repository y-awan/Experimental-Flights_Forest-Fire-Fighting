'use client'

import L from 'leaflet'
import { useEffect } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import { BOUNDARY, HOME } from '@/lib/mission/data'
import { fromLatLng, type XY } from '@/lib/mission/geo'
import { useDispatch, useMission } from '../store'
import { ll } from './leaflet-utils'

const MISSION_BOUNDS = L.latLngBounds([...BOUNDARY, HOME].map(ll))

/** Exposes the Leaflet map instance and executes `state.focus` camera requests. */
export function CameraController({ onReady }: { onReady: (m: L.Map) => void }) {
  const map = useMap()
  const { focus } = useMission()
  useEffect(() => {
    onReady(map)
    map.fitBounds(MISSION_BOUNDS, { padding: [36, 36] })
  }, [map, onReady])
  useEffect(() => {
    if (!focus) return
    if (focus.kind === 'point') map.flyTo(ll(focus.pos), focus.zoom ?? Math.max(map.getZoom(), 15), { duration: 0.6 })
    else if (focus.kind === 'bounds') map.flyToBounds(L.latLngBounds(focus.points.map(ll)), { padding: [60, 60], duration: 0.6 })
    else map.flyToBounds(MISSION_BOUNDS, { padding: [36, 36], duration: 0.6 })
  }, [focus, map])
  return null
}

/** Map clicks (region drawing) and cursor position reporting. */
export function PointerController({
  onCursor,
  onContextMenu,
}: {
  onCursor: (p: XY | null) => void
  onContextMenu: (point: XY, screen: { x: number; y: number }) => void
}) {
  const { draft } = useMission()
  const dispatch = useDispatch()
  const map = useMapEvents({
    click(e) {
      if (draft.drawing) dispatch({ type: 'addPoint', point: fromLatLng(e.latlng.lat, e.latlng.lng) })
    },
    contextmenu(e) {
      onContextMenu(fromLatLng(e.latlng.lat, e.latlng.lng), { x: e.containerPoint.x, y: e.containerPoint.y })
    },
    mousemove(e) {
      onCursor(fromLatLng(e.latlng.lat, e.latlng.lng))
    },
    mouseout() {
      onCursor(null)
    },
  })
  useEffect(() => {
    if (draft.drawing) map.doubleClickZoom.disable()
    else map.doubleClickZoom.enable()
  }, [draft.drawing, map])
  return null
}
