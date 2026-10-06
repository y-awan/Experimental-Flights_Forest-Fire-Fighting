import type { ComponentType } from 'react'
import { DetectionLayer, DroneLayer } from './assets'
import { RouteLayer, TrailLayer } from './movement'
import { RegionLayer } from './regions'
import { SectorLayer } from './sectors'
import { BoundaryLayer, HomeLayer } from './static-layers'

export type MapLayerDef = {
  id: string
  /** Prop-less, memoized component. Read state with useMapState(), never useMission(). */
  Component: ComponentType
}

/**
 * Every overlay on the map, in paint order (first = bottom).
 * To add a layer: create a memo() component in this folder and append it here.
 */
export const MAP_LAYERS: MapLayerDef[] = [
  { id: 'boundary', Component: BoundaryLayer },
  { id: 'sectors', Component: SectorLayer },
  { id: 'trails', Component: TrailLayer },
  { id: 'routes', Component: RouteLayer },
  { id: 'regions', Component: RegionLayer },
  { id: 'home', Component: HomeLayer },
  { id: 'detection', Component: DetectionLayer },
  { id: 'drones', Component: DroneLayer },
]
