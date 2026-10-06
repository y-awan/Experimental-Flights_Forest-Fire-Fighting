'use client'

import { Pause, Play } from 'lucide-react'
import { MISSION_NAME, SCENARIO_ID, clockAt, elapsedLabel } from '@/lib/mission/data'
import { droneHealth } from '@/lib/mission/derive'
import { cn } from '@/lib/utils'
import { Flag } from './glyph'
import { useDispatch, useMission } from './store'

function ModeBlock() {
  const { mode } = useMission()
  if (mode === 'live')
    return (
      <div className="flex shrink-0 items-center gap-3 bg-live px-3 text-white sm:px-4">
        <span className="font-mono text-[13px] font-bold tracking-[0.12em] sm:text-[15px]">LIVE</span>
        <span className="hidden text-[12px] leading-tight xl:block">
          Real aircraft
          <br />
          Commands will fly
        </span>
      </div>
    )
  return (
    <div className="sim-hatch flex shrink-0 items-center gap-3 px-3 text-ink sm:px-4">
      <span className="font-mono text-[13px] font-bold tracking-[0.12em] sm:text-[15px]">
        <span className="sm:hidden" aria-label="Simulation">
          SIM
        </span>
        <span className="hidden sm:inline">SIMULATION</span>
      </span>
      <span className="hidden text-[12px] font-medium leading-tight xl:block">
        Scenario {SCENARIO_ID}
        <br />
        Commands cannot reach real aircraft
      </span>
    </div>
  )
}

function missionState(state: ReturnType<typeof useMission>) {
  if (state.paused && state.mode === 'simulation') return 'Paused'
  if (state.detection.status === 'unreviewed') return 'Surveying · detection under review'
  return 'Surveying'
}

function TimeControls() {
  const state = useMission()
  const dispatch = useDispatch()
  const clock = (
    <div className="flex flex-col items-end leading-tight" title={`Scenario clock ${clockAt(state.elapsed)} PDT`}>
      <span className="label hidden text-[11px] sm:block">{state.mode === 'live' ? 'Mission time' : 'Simulation time'}</span>
      <span className="font-mono text-[14px] tabular-nums text-fg sm:text-[15px]">T+{elapsedLabel(state.elapsed)}</span>
    </div>
  )
  if (state.mode === 'live') return clock
  return (
    <div className="flex items-center gap-2 sm:gap-3" role="group" aria-label="Simulation time controls">
      {clock}
      <div role="radiogroup" aria-label="Simulation speed" className="hidden overflow-hidden rounded-md border border-line-strong sm:flex">
        {([1, 2, 4] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={state.speed === s}
            onClick={() => dispatch({ type: 'setSpeed', speed: s })}
            className={cn(
              'h-8 w-9 font-mono text-[12px]',
              state.speed === s ? 'bg-fg font-semibold text-ink' : 'text-fg-muted hover:bg-raised hover:text-fg',
            )}
          >
            {s}×
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={state.paused}
        aria-label={state.paused ? 'Resume simulation' : 'Pause simulation'}
        className={cn('btn h-9 w-9 px-0 lg:h-8 lg:w-[88px] lg:px-3', state.paused && 'border-sim text-sim')}
        onClick={() => dispatch({ type: 'togglePause' })}
      >
        {state.paused ? <Play className="size-4 lg:size-3.5" aria-hidden="true" /> : <Pause className="size-4 lg:size-3.5" aria-hidden="true" />}
        <span className="hidden lg:inline">{state.paused ? 'Resume' : 'Pause'}</span>
      </button>
    </div>
  )
}

export function useFleetCounts() {
  const state = useMission()
  const healths = state.drones.map((d, i) => droneHealth(d, state.elapsed, i))
  return {
    airborne: state.drones.filter((d) => d.reported.altitude > 0.5).length,
    total: state.drones.length,
    critical: healths.filter((h) => h.level === 'critical').length,
    caution: healths.filter((h) => h.level !== 'critical' && (h.level === 'caution' || h.stale)).length,
    anyStale: healths.some((h) => h.stale),
  }
}

export function LinkStatus() {
  const { mode } = useMission()
  const { anyStale } = useFleetCounts()
  const live = mode === 'live'
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className={cn('size-2 rounded-full', anyStale ? 'border border-dashed border-fg' : 'bg-ok')} />
      {live ? (anyStale ? 'Ground link partial' : 'Ground link good') : anyStale ? 'SITL partial' : 'SITL connected'}
    </span>
  )
}

function FleetSummary() {
  const { airborne, critical, caution } = useFleetCounts()
  return (
    <div className="flex items-center gap-4 text-[13px]">
      <ul aria-label="Fleet status" className="flex items-center gap-3">
        <li className="text-fg">{airborne} airborne</li>
        {critical > 0 && (
          <li className="flex items-center gap-1 font-semibold text-critical">
            <Flag kind="critical" />
            {critical} critical
          </li>
        )}
        {caution > 0 && (
          <li className="flex items-center gap-1 font-semibold text-caution">
            <Flag kind="caution" />
            {caution} caution
          </li>
        )}
      </ul>
      <span className="hidden border-l border-line pl-4 xl:block">
        <LinkStatus />
      </span>
    </div>
  )
}

export function ModeSwitchButton({ className }: { className?: string }) {
  const { mode } = useMission()
  const dispatch = useDispatch()
  if (mode === 'live')
    return (
      <button type="button" className={cn('btn', className)} onClick={() => dispatch({ type: 'setMode', mode: 'simulation' })}>
        Return to simulation
      </button>
    )
  return (
    <button
      type="button"
      className={cn('btn border-live/70 text-[#f6a29c] hover:border-live hover:bg-live/15', className)}
      onClick={() => dispatch({ type: 'requestConfirm', request: { kind: 'go-live' } })}
    >
      Connect live aircraft
    </button>
  )
}

export function TopBar() {
  const state = useMission()
  const live = state.mode === 'live'
  return (
    <header
      className={cn(
        'flex h-12 shrink-0 items-stretch border-b-2 bg-surface pt-[env(safe-area-inset-top)] lg:h-14',
        live ? 'border-live' : 'border-sim',
      )}
    >
      <ModeBlock />
      <div className="flex min-w-0 flex-1 items-center gap-3 px-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4 lg:px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[14px] font-semibold leading-tight lg:text-[15px]">{MISSION_NAME}</h1>
          <p className={cn('truncate text-[12px] leading-tight', state.detection.status === 'unreviewed' ? 'text-caution' : 'text-fg-muted')}>
            {missionState(state)}
          </p>
        </div>
        <TimeControls />
        <div className="hidden items-center justify-end gap-4 lg:flex">
          <FleetSummary />
          <ModeSwitchButton />
        </div>
      </div>
    </header>
  )
}
