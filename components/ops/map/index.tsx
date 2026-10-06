'use client'

import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, ScaleControl } from 'react-leaflet'
import type { XY } from '@/lib/mission/geo'
import { useMission } from '../store'
import { CameraController, PointerController } from './controllers'
import { MAP_LAYERS } from './layers'
import { ll } from './leaflet-utils'
import { MapStateProvider } from './map-state'
import { BasemapLayer } from './tiles'

export type OpsMapProps = {
  /** Receives the Leaflet map once mounted (used by external zoom buttons). */
  onReady: (map: L.Map) => void
  /** Cursor position in mission XY metres, or null when the pointer leaves the map. */
  onCursor: (p: XY | null) => void
  /** Opens the map action menu at a geographic point. */
  onContextMenu: (point: XY, screen: { x: number; y: number }) => void
}

const INITIAL_CENTER = ll({ x: 300, y: 0 })

export default function OpsMap({ onReady, onCursor, onContextMenu }: OpsMapProps) {
  const { basemap, draft } = useMission()
  // Vectors are drawn one viewport beyond each edge so zoom-out animations never expose clipped lines.
  const renderer = useMemo(() => L.svg({ padding: 1 }), [])
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className={draft.drawing ? 'ops-drawing h-full w-full' : 'h-full w-full'}>
      <MapContainer
        center={INITIAL_CENTER}
        zoom={14}
        zoomControl={false}
        className="h-full w-full"
        renderer={renderer}
        keyboard
        zoomAnimation
        zoomAnimationThreshold={8}
        wheelDebounceTime={30}
        wheelPxPerZoomLevel={90}
      >
        <BasemapLayer key={basemap} basemap={basemap} />
        <CameraController onReady={onReady} />
        <PointerController onCursor={onCursor} onContextMenu={onContextMenu} />
        <MapStateProvider>
          {MAP_LAYERS.map(({ id, Component }) => (
            <Component key={id} />
          ))}
        </MapStateProvider>
        <ScaleControl position="bottomright" imperial={false} />
      </MapContainer>
    </div>
  )
}
