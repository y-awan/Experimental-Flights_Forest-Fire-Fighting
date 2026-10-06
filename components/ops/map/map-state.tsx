'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useMap } from 'react-leaflet'
import type { MissionState } from '@/lib/mission/sim'
import { useMission } from '../store'

const MapStateCtx = createContext<MissionState | null>(null)

/**
 * Supplies mission state to map layers, frozen for the duration of any zoom animation.
 *
 * Why: Leaflet CSS-scales the vector/marker panes while a zoom animates. If a layer calls
 * setLatLngs/setLatLng/setStyle mid-animation it is re-projected at the target zoom *inside*
 * an already-scaled pane, so geometry visibly jumps and rescales. The sim ticks every 200 ms,
 * so without this freeze sectors and drones "freak out" on every scroll zoom.
 */
export function MapStateProvider({ children }: { children: ReactNode }) {
  const live = useMission()
  const map = useMap()
  const liveRef = useRef(live)
  const [snapshot, setSnapshot] = useState<MissionState | null>(null)

  useEffect(() => {
    liveRef.current = live
  }, [live])

  useEffect(() => {
    const freeze = () => setSnapshot(liveRef.current)
    const thaw = () => setSnapshot(null)
    map.on('zoomstart', freeze)
    map.on('zoomend', thaw)
    return () => {
      map.off('zoomstart', freeze)
      map.off('zoomend', thaw)
    }
  }, [map])

  return <MapStateCtx.Provider value={snapshot ?? live}>{children}</MapStateCtx.Provider>
}

/** Mission state for map layers. Use this (not useMission) inside anything rendered on the map. */
export function useMapState() {
  const s = useContext(MapStateCtx)
  if (!s) throw new Error('useMapState outside MapStateProvider')
  return s
}
