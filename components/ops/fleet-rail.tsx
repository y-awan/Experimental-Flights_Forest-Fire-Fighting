'use client'

import { ChevronLeft } from 'lucide-react'
import { useMobileView } from './mobile-view'
import { LinkStatus, ModeSwitchButton, useFleetCounts } from './top-bar'
import { CRITICAL_PCT, HOME, HOME_NAME, RESERVE_PCT } from '@/lib/mission/data'
import { activeCommand, activity, droneHealth, linkState, nextWaypoint, type Health } from '@/lib/mission/derive'
import { DRONE_ACCENT } from '@/lib/mission/glyph'
import type { Drone } from '@/lib/mission/types'
import { cn } from '@/lib/utils'
import { CommandCompact } from './command-status'
import { DroneGlyph, HealthTag } from './glyph'
import { useDispatch, useMission } from './store'
import { fmtDuration } from './format'

function BatteryMeter({ pct, health }: { pct: number; health: Health }) {
  const tone = health.stale ? 'bg-fg-subtle' : pct <= CRITICAL_PCT ? 'bg-critical' : pct <= RESERVE_PCT ? 'bg-caution' : 'bg-fg-muted'
  return (
    <span className="relative inline-block h-2 w-16 rounded-[1px] bg-line-strong" aria-hidden="true">
      <span className={cn('absolute inset-y-0 left-0 rounded-[1px]', tone)} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      <span className="absolute inset-y-[-3px] w-px bg-fg" style={{ left: `${RESERVE_PCT}%` }} />
    </span>
  )
}

function DroneRow({ drone, index }: { drone: Drone; index: number }) {
  const state = useMission()
  const dispatch = useDispatch()
  const { setPanel } = useMobileView()
  const selected = state.selection.type === 'drone' && state.selection.id === drone.id
  const hovered = state.hover === drone.id
  const health = droneHealth(drone, state.elapsed, index)
  const link = linkState(health)
  const r = drone.reported
  const act = activity(drone, state.progress, state.detection)
  const next = nextWaypoint(drone, state.progress, state.detection)
  const cmd = activeCommand(state.commands, drone.id)
  const showCmd = cmd && (cmd.stage !== 'completed' || state.elapsed - (cmd.stamps.completed ?? 0) < 6)
  const lowBattery = !health.stale && health.airborne && r.battery <= RESERVE_PCT

  let suffix = ''
  if (next && r.mode === 'rth') suffix = `ETA ${fmtDuration(next.eta)}`
  if (next && r.mode === 'investigate') suffix = `Arrives in ${fmtDuration(next.eta)}`

  const showIssue = health.issue && (health.stale || health.level !== 'nominal')

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: 'select', selection: { type: 'drone', id: drone.id } })
          setPanel('map')
        }}
        onMouseEnter={() => dispatch({ type: 'hover', id: drone.id })}
        onMouseLeave={() => dispatch({ type: 'hover', id: null })}
        aria-pressed={selected}
        aria-label={`${drone.name}, ${act}, battery ${Math.round(r.battery)} percent, ${link.label}${health.issue ? `, ${health.issue}` : ''}`}
        className={cn(
          'relative grid w-full grid-cols-[30px_minmax(0,1fr)] gap-x-2.5 border-b border-line px-3 py-3 text-left transition-colors',
          selected ? 'bg-raised' : hovered ? 'bg-[#211f1c]' : 'hover:bg-[#211f1c]',
          health.level === 'critical' && !selected && 'bg-critical/[0.07]',
        )}
      >
        {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-select" />}
        <DroneGlyph
          accent={DRONE_ACCENT[drone.id]}
          label={drone.short.slice(1)}
          severity={health.level}
          stale={health.stale}
          selected={selected}
          heading={health.airborne ? r.heading : null}
          size={30}
          className="mt-[-3px]"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold">{drone.name}</span>
            <HealthTag health={health} />
            <span className="ml-auto flex items-center gap-2">
              <BatteryMeter pct={r.battery} health={health} />
              <span
                className={cn(
                  'w-9 text-right font-mono text-[13px] tabular-nums',
                  health.stale ? 'text-fg-subtle' : 'text-fg',
                  lowBattery && 'font-semibold text-caution',
                  !health.stale && health.airborne && r.battery <= CRITICAL_PCT && 'text-critical',
                )}
              >
                {Math.round(r.battery)}%
              </span>
            </span>
          </div>
          <p className={cn('mt-0.5 text-[13px] leading-snug', health.stale ? 'italic text-fg-muted' : 'text-fg')}>
            {act}
            {suffix && <span className="text-fg-muted">{` · ${suffix}`}</span>}
          </p>
          <p className={cn('mt-1 text-[12px]', health.stale ? 'text-fg-subtle' : 'text-fg-muted')}>
            Altitude <span className="font-mono text-fg">{Math.round(r.altitude)} m</span>
            {' · '}Updated{' '}
            <span className={cn('font-mono', health.stale ? 'font-semibold text-fg' : 'text-fg')}>
              {health.stale ? `${Math.floor(health.age)}s` : `${health.age.toFixed(1)}s`}
            </span>{' '}
            ago
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-fg-muted">
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 rounded-full',
                link.tone === 'ok' && 'bg-ok',
                link.tone === 'caution' && 'border border-dashed border-fg bg-transparent',
                link.tone === 'critical' && 'bg-critical',
              )}
            />
            {link.label}
          </p>
          {showIssue && (
            <p className={cn('mt-1.5 text-[12px] leading-snug', health.level === 'critical' ? 'text-critical' : health.stale ? 'text-fg' : 'text-caution')}>
              {health.issue}
              {health.stale && ' · values are last known'}
            </p>
          )}
          {showCmd && cmd && (
            <div className="mt-1.5">
              <CommandCompact cmd={cmd} droneName={drone.name} />
            </div>
          )}
        </div>
      </button>
    </li>
  )
}

export function FleetRail({ className }: { className?: string }) {
  const state = useMission()
  const dispatch = useDispatch()
  const { setPanel } = useMobileView()
  const { airborne, critical, caution } = useFleetCounts()

  return (
    <nav aria-label="Fleet" className={cn('min-h-0 flex-col overflow-y-auto border-r border-line bg-surface', className)}>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-3 py-2 lg:static lg:items-baseline lg:justify-between lg:border-b-0 lg:pb-2 lg:pt-3">
        <button type="button" onClick={() => setPanel('map')} className="btn h-9 gap-1 px-2.5 lg:hidden">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Map
        </button>
        <h2 className="text-[15px] font-semibold text-fg lg:text-[13px]">Fleet</h2>
        <span className="ml-auto text-[12px] text-fg-muted lg:ml-0">
          {airborne} of {state.drones.length} airborne
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-3 py-2 text-[12px] text-fg-muted lg:hidden">
        <LinkStatus />
        {critical > 0 && <span className="font-semibold text-critical">{critical} critical</span>}
        {caution > 0 && <span className="font-semibold text-caution">{caution} caution</span>}
      </div>
      <ul className="border-t border-line">
        {state.drones.map((d, i) => (
          <DroneRow key={d.id} drone={d} index={i} />
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: 'focus', focus: { kind: 'point', pos: HOME, zoom: 16 } })
          setPanel('map')
        }}
        className="flex items-center gap-2.5 border-b border-line px-3 py-3 text-left text-[12px] text-fg-muted hover:bg-[#211f1c] lg:py-2.5"
      >
        <span aria-hidden="true" className="ml-1 flex size-[22px] items-center justify-center border-[1.5px] border-fg font-mono text-[11px] font-bold text-fg">
          H
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-fg">{HOME_NAME}</span>
          Launch and landing zone
        </span>
      </button>
      <div className="mt-auto border-t border-line px-3 py-3 lg:hidden">
        <ModeSwitchButton className="h-10 w-full" />
        <p className="mt-2 text-[12px] text-fg-subtle">Battery tick marks the {RESERVE_PCT}% reserve</p>
      </div>
      <div className="mt-auto hidden border-t border-line px-3 py-2.5 text-[12px] leading-relaxed text-fg-subtle lg:block">
        <p>
          <kbd className="font-mono text-fg-muted">1</kbd>
          {'–'}
          <kbd className="font-mono text-fg-muted">3</kbd> select drone · <kbd className="font-mono text-fg-muted">F</kbd> detection ·{' '}
          <kbd className="font-mono text-fg-muted">Esc</kbd> clear
        </p>
        <p>Battery tick marks the {RESERVE_PCT}% reserve</p>
      </div>
    </nav>
  )
}
