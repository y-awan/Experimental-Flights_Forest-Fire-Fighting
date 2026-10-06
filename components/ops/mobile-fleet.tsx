'use client'

import { List, X } from 'lucide-react'
import { CRITICAL_PCT, RESERVE_PCT } from '@/lib/mission/data'
import { activity, droneHealth, linkState } from '@/lib/mission/derive'
import { DRONE_ACCENT } from '@/lib/mission/glyph'
import { cn } from '@/lib/utils'
import { DroneGlyph, HealthTag } from './glyph'
import { useMobileView } from './mobile-view'
import { useDispatch, useMission } from './store'

function batteryTone(pct: number, stale: boolean, airborne: boolean) {
  if (stale) return 'text-fg-subtle'
  if (airborne && pct <= CRITICAL_PCT) return 'font-semibold text-critical'
  if (airborne && pct <= RESERVE_PCT) return 'font-semibold text-caution'
  return 'text-fg'
}

/** Compact detail card for the selected drone, shown above the strip on small screens. */
function SelectedDroneCard() {
  const state = useMission()
  const dispatch = useDispatch()
  const { setPanel } = useMobileView()
  if (state.selection.type !== 'drone') return null
  const id = state.selection.id
  const index = state.drones.findIndex((d) => d.id === id)
  const drone = state.drones[index]
  if (!drone) return null
  const health = droneHealth(drone, state.elapsed, index)
  const link = linkState(health)
  const r = drone.reported

  return (
    <div className="pointer-events-auto border border-line-strong bg-bg/95 px-3 py-2 text-[12px] shadow-lg backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold text-fg">{drone.name}</span>
        <HealthTag health={health} />
        <span className={cn('ml-auto font-mono text-[14px] tabular-nums', batteryTone(r.battery, health.stale, health.airborne))}>
          {Math.round(r.battery)}%
        </span>
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => dispatch({ type: 'select', selection: { type: 'mission' }, focus: false })}
          className="btn btn-ghost -mr-1.5 h-8 w-8 px-0"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p className={cn('mt-0.5 text-[13px] leading-snug', health.stale ? 'italic text-fg-muted' : 'text-fg')}>
        {activity(drone, state.progress, state.detection)}
      </p>
      <div className="mt-1 flex items-center gap-3 text-fg-muted">
        <span>
          Alt <span className="font-mono text-fg">{Math.round(r.altitude)} m</span>
        </span>
        <span>{link.label}</span>
        <button type="button" onClick={() => setPanel('fleet')} className="ml-auto font-medium text-select underline-offset-2 hover:underline">
          Full details
        </button>
      </div>
      {health.issue && (health.stale || health.level !== 'nominal') && (
        <p className={cn('mt-1 leading-snug', health.level === 'critical' ? 'text-critical' : health.stale ? 'text-fg' : 'text-caution')}>
          {health.issue}
        </p>
      )}
    </div>
  )
}

/**
 * Small-screen fleet access layered over the map: a horizontally scrollable strip of drone chips
 * (tap to select and fly to a drone) plus a button that opens the full fleet panel. Hidden from `lg` up.
 */
export function MobileFleetOverlay() {
  const state = useMission()
  const dispatch = useDispatch()
  const { setPanel } = useMobileView()

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 z-[600] flex flex-col gap-2 lg:hidden">
      <SelectedDroneCard />
      <div className="pointer-events-auto flex items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => setPanel('fleet')}
          className="flex shrink-0 items-center gap-1.5 border border-line-strong bg-bg/95 px-3 text-[13px] font-medium text-fg backdrop-blur-sm"
        >
          <List className="size-4" aria-hidden="true" />
          Fleet
        </button>
        <ul aria-label="Drones" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {state.drones.map((d, i) => {
            const health = droneHealth(d, state.elapsed, i)
            const selected = state.selection.type === 'drone' && state.selection.id === d.id
            return (
              <li key={d.id} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${d.name}, battery ${Math.round(d.reported.battery)} percent${health.issue ? `, ${health.issue}` : ''}`}
                  onClick={() => dispatch({ type: 'select', selection: { type: 'drone', id: d.id } })}
                  className={cn(
                    'flex h-11 items-center gap-2 border bg-bg/95 pl-1.5 pr-2.5 backdrop-blur-sm',
                    selected ? 'border-select' : health.level === 'critical' ? 'border-critical' : 'border-line-strong',
                  )}
                >
                  <DroneGlyph
                    accent={DRONE_ACCENT[d.id]}
                    label={d.short.slice(1)}
                    severity={health.level}
                    stale={health.stale}
                    selected={selected}
                    heading={health.airborne ? d.reported.heading : null}
                    size={26}
                  />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-[12px] font-semibold text-fg">{d.short}</span>
                    <span className={cn('font-mono text-[12px] tabular-nums', batteryTone(d.reported.battery, health.stale, health.airborne))}>
                      {Math.round(d.reported.battery)}%
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
