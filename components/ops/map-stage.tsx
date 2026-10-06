'use client'

import dynamic from 'next/dynamic'
import type L from 'leaflet'
import { Copy, Crosshair, Layers, Maximize, Minus, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { formatCoord, type XY } from '@/lib/mission/geo'
import { DRONE_ACCENT } from '@/lib/mission/glyph'
import type { MapLayers } from '@/lib/mission/types'
import { cn } from '@/lib/utils'
import { DroneGlyph, Flag } from './glyph'
import { LiveFeedPanel, FeedLauncher } from './live-feed-panel'
import { MobileFleetOverlay } from './mobile-fleet'
import { useDispatch, useMission } from './store'

const OpsMap = dynamic(() => import('./map'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-[13px] text-fg-subtle">Loading basemap…</div>,
})

const LAYER_LABELS: { key: keyof MapLayers; label: string }[] = [
  { key: 'sectors', label: 'Sectors' },
  { key: 'planned', label: 'Planned' },
  { key: 'completed', label: 'Covered' },
  { key: 'trails', label: 'Trails' },
]

function LayerToggles({ className, itemClassName }: { className?: string; itemClassName?: string }) {
  const { layers } = useMission()
  const dispatch = useDispatch()
  return (
    <div className={className}>
      {LAYER_LABELS.map((l) => (
        <button
          key={l.key}
          type="button"
          aria-pressed={layers[l.key]}
          onClick={() => dispatch({ type: 'toggleLayer', layer: l.key })}
          className={cn(
            'flex items-center gap-1.5 rounded-sm px-2 transition-colors hover:bg-raised',
            layers[l.key] ? 'text-fg' : 'text-fg-subtle line-through decoration-fg-subtle',
            itemClassName,
          )}
        >
          <span aria-hidden="true" className={cn('size-2.5 shrink-0 border', layers[l.key] ? 'border-fg bg-fg' : 'border-fg-subtle')} />
          {l.label}
        </button>
      ))}
    </div>
  )
}

function BasemapSwitch() {
  const { basemap } = useMission()
  const dispatch = useDispatch()
  return (
    <div role="radiogroup" aria-label="Basemap" className="flex">
      {(['topo', 'imagery'] as const).map((b) => (
        <button
          key={b}
          type="button"
          role="radio"
          aria-checked={basemap === b}
          onClick={() => dispatch({ type: 'setBasemap', basemap: b })}
          className={cn(
            'h-9 px-2 lg:h-7',
            basemap === b ? 'font-semibold text-fg underline decoration-2 underline-offset-[6px]' : 'text-fg-muted hover:text-fg',
          )}
        >
          {b === 'topo' ? 'Terrain' : 'Imagery'}
        </button>
      ))}
    </div>
  )
}

function DrawControls() {
  const { draft, region } = useMission()
  const dispatch = useDispatch()
  if (!draft.drawing)
    return (
      <button type="button" className="btn h-9 px-2.5 lg:h-7 lg:px-2" onClick={() => dispatch({ type: 'startDraw' })}>
        {region ? 'Redraw' : 'Draw'}
        <span className="hidden sm:inline">{region ? ' region' : ' patrol region'}</span>
      </button>
    )
  return (
    <>
      <span className="mr-1 hidden text-select xl:inline">
        {draft.points.length < 3 ? `Click map to add vertices (${draft.points.length})` : `${draft.points.length} vertices · click first vertex or Finish`}
      </span>
      <button type="button" className="btn h-9 px-2.5 lg:h-7 lg:px-2" disabled={!draft.points.length} onClick={() => dispatch({ type: 'undoPoint' })}>
        Undo
      </button>
      <button type="button" className="btn h-9 px-2.5 lg:h-7 lg:px-2" onClick={() => dispatch({ type: 'cancelDraw' })}>
        Cancel
      </button>
      <button
        type="button"
        className="btn btn-primary h-9 px-2.5 lg:h-7 lg:px-2"
        disabled={draft.points.length < 3}
        onClick={() => dispatch({ type: 'finishDraw' })}
      >
        Finish
        <span className="hidden sm:inline"> region</span>
      </button>
    </>
  )
}

function Toolbar({ map }: { map: L.Map | null }) {
  const { draft } = useMission()
  const dispatch = useDispatch()
  const [layersOpen, setLayersOpen] = useState(false)
  return (
    <div className="relative z-[700] flex h-11 shrink-0 items-center gap-1 border-b border-line bg-surface px-2 text-[13px] lg:h-9 lg:text-[12px]">
      <span className="label mr-1 hidden xl:inline">Layers</span>
      <LayerToggles className="hidden items-center gap-1 lg:flex" itemClassName="h-7" />

      {!draft.drawing && (
        <div className="relative lg:hidden">
          <button
            type="button"
            aria-expanded={layersOpen}
            aria-controls="mobile-layers"
            onClick={() => setLayersOpen((o) => !o)}
            className={cn('btn h-9 gap-1.5 px-2.5', layersOpen && 'border-fg-subtle')}
          >
            <Layers className="size-4" aria-hidden="true" />
            Layers
          </button>
          {layersOpen && (
            <div id="mobile-layers" className="absolute left-0 top-full mt-1 w-44 border border-line-strong bg-bg py-1 shadow-lg">
              <LayerToggles className="flex flex-col" itemClassName="h-10 w-full rounded-none px-3 text-[14px]" />
            </div>
          )}
        </div>
      )}

      <span aria-hidden="true" className="mx-1.5 hidden h-4 w-px bg-line-strong lg:block" />
      {!draft.drawing && <BasemapSwitch />}

      <div className="ml-auto flex items-center gap-1">
        <DrawControls />
        {!draft.drawing && (
          <>
            <span aria-hidden="true" className="mx-1 hidden h-4 w-px bg-line-strong sm:block" />
            <button
              type="button"
              aria-label="Fit mission"
              className="btn btn-ghost h-9 w-9 px-0 lg:h-7 lg:w-auto lg:px-2"
              onClick={() => dispatch({ type: 'focus', focus: { kind: 'fit' } })}
            >
              <Maximize className="size-4 lg:hidden" aria-hidden="true" />
              <span className="hidden lg:inline">Fit mission</span>
            </button>
          </>
        )}
        <button type="button" aria-label="Zoom out" className="btn btn-ghost hidden h-7 w-7 px-0 lg:inline-flex" onClick={() => map?.zoomOut()}>
          <Minus className="size-4" />
        </button>
        <button type="button" aria-label="Zoom in" className="btn btn-ghost hidden h-7 w-7 px-0 lg:inline-flex" onClick={() => map?.zoomIn()}>
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  )
}

function LineSample({ dash, weight = 2, color = '#15140f' }: { dash?: string; weight?: number; color?: string }) {
  return (
    <svg width="26" height="8" aria-hidden="true">
      <line x1="0" y1="4" x2="26" y2="4" stroke="#f2f0e8" strokeWidth={weight + 2.5} strokeOpacity="0.6" strokeDasharray={dash} />
      <line x1="0" y1="4" x2="26" y2="4" stroke={color} strokeWidth={weight} strokeDasharray={dash} />
    </svg>
  )
}

function Legend() {
  const [open, setOpen] = useState(false)
  return (
    <div className="pointer-events-auto absolute left-2 top-2 z-[500] max-w-[260px] border border-line-strong bg-bg text-[12px] text-fg-muted lg:bottom-3 lg:left-3 lg:top-auto">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-6 px-2.5 text-left font-medium text-fg lg:h-auto lg:py-1.5"
      >
        Map key
        <span aria-hidden="true" className="font-mono text-fg-subtle">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <dl className="grid max-h-[50dvh] grid-cols-[34px_1fr] items-center gap-x-2 gap-y-1.5 overflow-y-auto border-t border-line px-2.5 py-2">
          <dt className="flex gap-0.5">
            <DroneGlyph accent={DRONE_ACCENT.d1} label="1" severity="nominal" stale={false} selected={false} heading={null} size={18} />
          </dt>
          <dd>Rotor colour identifies the drone</dd>
          <dt>
            <DroneGlyph accent={DRONE_ACCENT.d1} label="" severity="nominal" stale={false} selected heading={0} size={26} />
          </dt>
          <dd>Blue ring: selected · pointer: heading</dd>
          <dt>
            <DroneGlyph accent={DRONE_ACCENT.d1} label="" severity="caution" stale={false} selected={false} heading={null} size={22} />
          </dt>
          <dd className="flex items-center gap-1">
            <Flag kind="caution" /> Amber fill: below reserve
          </dd>
          <dt>
            <DroneGlyph accent={DRONE_ACCENT.d1} label="" severity="critical" stale={false} selected={false} heading={null} size={22} />
          </dt>
          <dd className="flex items-center gap-1">
            <Flag kind="critical" /> Red fill: critical / link lost
          </dd>
          <dt>
            <DroneGlyph accent={DRONE_ACCENT.d1} label="" severity="nominal" stale selected={false} heading={null} size={22} />
          </dt>
          <dd className="flex items-center gap-1">
            <Flag kind="stale" /> Dashed outline: stale, last known
          </dd>
          <dt>
            <LineSample weight={3} />
          </dt>
          <dd>Covered survey lanes</dd>
          <dt>
            <LineSample dash="3 5" weight={1.25} />
          </dt>
          <dd>Planned lanes</dd>
          <dt>
            <LineSample dash="7 5" />
          </dt>
          <dd>Active route (return / investigate)</dd>
          <dt>
            <svg width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true">
              <circle r="9" fill="#ec5a50" fillOpacity="0.2" stroke="#ec5a50" strokeDasharray="2 2" />
              <path d="M0 -4 L4 0 L0 4 L-4 0 Z" fill="#f2f0e8" stroke="#15140f" />
            </svg>
          </dt>
          <dd>Possible fire · circle = location uncertainty</dd>
        </dl>
      )}
    </div>
  )
}

export function MapStage() {
  const { mode, paused, draft, drones, selection } = useMission()
  const [map, setMap] = useState<L.Map | null>(null)
  const [feedOpen, setFeedOpen] = useState(false)
  const [cursor, setCursor] = useState<XY | null>(null)
  const [contextMenu, setContextMenu] = useState<{ point: XY; x: number; y: number } | null>(null)
  const onReady = useCallback((m: L.Map) => setMap(m), [])
  const live = mode === 'live'
  const selectedDrone = selection.type === 'drone' ? drones.find((drone) => drone.id === selection.id) ?? null : null
  const openContextMenu = useCallback((point: XY, screen: { x: number; y: number }) => {
    setContextMenu({ point, x: screen.x, y: screen.y })
  }, [])

  return (
    <section aria-label="Mission map" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Toolbar map={map} />
      <div className="ops-map-frame relative min-h-0 flex-1">
        <OpsMap onReady={onReady} onCursor={setCursor} onContextMenu={openContextMenu} />
        {contextMenu && (
          <div
            role="menu"
            aria-label="Map actions"
            className="pointer-events-auto absolute z-[800] w-48 border border-line-strong bg-bg p-1 text-[13px] shadow-xl"
            style={{ left: Math.min(contextMenu.x, Math.max(8, (map?.getSize().x ?? 320) - 200)), top: Math.min(contextMenu.y, Math.max(8, (map?.getSize().y ?? 240) - 118)) }}
            onMouseLeave={() => setContextMenu(null)}
          >
            <button type="button" role="menuitem" className="flex h-9 w-full items-center gap-2 px-2 text-left hover:bg-raised" onClick={() => { map?.flyTo([contextMenu.point.y, contextMenu.point.x], Math.max(map.getZoom(), 16), { duration: 0.5 }); setContextMenu(null) }}>
              <Crosshair className="size-4" aria-hidden="true" /> Center map here
            </button>
            <button type="button" role="menuitem" className="flex h-9 w-full items-center gap-2 px-2 text-left hover:bg-raised" onClick={() => { void navigator.clipboard?.writeText(`${contextMenu.point.x.toFixed(1)}, ${contextMenu.point.y.toFixed(1)}`); setContextMenu(null) }}>
              <Copy className="size-4" aria-hidden="true" /> Copy coordinates
            </button>
          </div>
        )}
        <div
          aria-hidden="true"
          className={cn('pointer-events-none absolute inset-0 z-[450]', live ? 'shadow-[inset_0_0_0_3px_var(--ops-live)]' : 'shadow-[inset_0_0_0_2px_var(--ops-sim)]')}
        />
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute right-0 top-0 z-[460] px-2 py-0.5 font-mono text-[11px] font-bold tracking-[0.12em]',
            live ? 'bg-live text-white' : 'sim-hatch text-ink',
          )}
        >
          {live ? 'LIVE' : 'SIM'}
          <span className="hidden sm:inline"> AIRCRAFT</span>
        </div>
        {paused && !live && (
          <div className="pointer-events-none absolute left-1/2 top-14 z-[470] -translate-x-1/2 whitespace-nowrap bg-sim px-3 py-1 font-mono text-[12px] font-bold tracking-[0.1em] text-ink lg:top-3">
            SIMULATION PAUSED<span className="hidden sm:inline"> · aircraft frozen</span>
          </div>
        )}
        {draft.drawing && (
          <div className="pointer-events-none absolute inset-x-2 top-14 z-[470] border border-select bg-bg px-3 py-1.5 text-center text-[12px] text-fg lg:inset-x-auto lg:left-1/2 lg:top-3 lg:-translate-x-1/2">
            <span className="lg:hidden">
              Tap the map to place vertices ({draft.points.length}
              {draft.points.length >= 3 ? ', tap first vertex or Finish' : ''}). Nothing is sent to aircraft.
            </span>
            <span className="hidden lg:inline">Drawing patrol region — click to place vertices. Nothing is sent to aircraft.</span>
          </div>
        )}
        <Legend />
        <MobileFleetOverlay />
        {selectedDrone && (
          <>
            {!feedOpen && <div className="pointer-events-auto absolute bottom-[72px] left-3 z-[610] lg:bottom-4"><FeedLauncher drone={selectedDrone} onOpen={() => setFeedOpen(true)} /></div>}
            {feedOpen && <LiveFeedPanel drone={selectedDrone} onClose={() => setFeedOpen(false)} />}
          </>
        )}
        <div className="pointer-events-none absolute bottom-[30px] right-3 z-[460] hidden bg-bg/90 px-1.5 py-0.5 font-mono text-[11px] text-fg-muted lg:block">
          {cursor ? formatCoord(cursor) : '—'}
        </div>
      </div>
    </section>
  )
}
