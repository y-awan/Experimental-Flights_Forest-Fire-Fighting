'use client'

import L from 'leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { BOUNDARY, HOME } from '@/lib/mission/data'
import type { MissionState } from '@/lib/mission/sim'
import { ll } from './leaflet-utils'

export type BasemapId = MissionState['basemap']

export const BASEMAPS: Record<BasemapId, { url: string; attribution: string }> = {
  topo: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles © Esri',
  },
  imagery: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © Esri, Maxar',
  },
}

/** Fraction of the viewport loaded beyond each edge so panning reveals already-loaded tiles. */
const TILE_OVERSCAN = 0.75
const PREFETCH_ZOOMS = [12, 13, 14, 15, 16]
const PREFETCH_BUDGET = 400

const BufferedTileLayer = L.TileLayer.extend({
  _getTiledPixelBounds(this: L.TileLayer, center: L.LatLng) {
    const base = (L.TileLayer.prototype as unknown as { _getTiledPixelBounds: (c: L.LatLng) => L.Bounds })._getTiledPixelBounds.call(this, center)
    const size = base.getSize()
    const pad = L.point(size.x * TILE_OVERSCAN, size.y * TILE_OVERSCAN)
    return L.bounds(base.min!.subtract(pad), base.max!.add(pad))
  },
}) as unknown as new (url: string, opts: L.TileLayerOptions) => L.TileLayer

const prefetched = new Set<string>()

/** Warms the browser HTTP cache with every tile covering the mission area at common zooms. */
function prefetchMissionTiles(url: string) {
  const bounds = L.latLngBounds([...BOUNDARY, HOME].map(ll)).pad(0.35)
  const crs = L.CRS.EPSG3857
  let budget = PREFETCH_BUDGET
  for (const z of PREFETCH_ZOOMS) {
    const nw = crs.latLngToPoint(bounds.getNorthWest(), z).divideBy(256).floor()
    const se = crs.latLngToPoint(bounds.getSouthEast(), z).divideBy(256).floor()
    for (let x = nw.x; x <= se.x; x++) {
      for (let y = nw.y; y <= se.y; y++) {
        if (budget-- <= 0) return
        const src = url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
        if (prefetched.has(src)) continue
        prefetched.add(src)
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.decoding = 'async'
        img.src = src
      }
    }
  }
}

export function BasemapLayer({ basemap }: { basemap: BasemapId }) {
  const map = useMap()
  useEffect(() => {
    const { url, attribution } = BASEMAPS[basemap]
    const layer = new BufferedTileLayer(url, {
      attribution,
      className: `ops-tiles-${basemap}`,
      maxZoom: 18,
      keepBuffer: 6,
      updateWhenZooming: false,
      crossOrigin: 'anonymous',
    }).addTo(map)
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300))
    idle(() => prefetchMissionTiles(url))
    return () => {
      layer.remove()
    }
  }, [map, basemap])
  return null
}
