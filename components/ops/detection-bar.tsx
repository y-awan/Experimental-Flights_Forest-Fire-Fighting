'use client'

import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { clockAt } from '@/lib/mission/data'
import { INVESTIGATE_SPEED, ORBIT_RADIUS, sectorPct } from '@/lib/mission/derive'
import { dist } from '@/lib/mission/geo'
import { interpret } from '@/lib/mission/interpret'
import type { MissionState } from '@/lib/mission/sim'
import { cn } from '@/lib/utils'
import { Flag } from './glyph'
import { useDispatch, useMission } from './store'
import { fmtSpoken } from './format'

export function investigationStatus(state: MissionState) {
  const det = state.detection
  const inv = state.drones.find((d) => d.id === det.investigator)
  if (!inv) return { drone: null, onScene: false, eta: null as number | null, text: 'No aircraft is responding.' }
  if (inv.reported.mode === 'orbit')
    return { drone: inv, onScene: true, eta: 0, text: `${inv.name} is on scene, orbiting at 60 m and streaming thermal imagery.` }
  if (inv.reported.mode === 'investigate') {
    const eta = Math.max(0, dist(inv.reported.pos, det.pos) - ORBIT_RADIUS) / INVESTIGATE_SPEED
    return { drone: inv, onScene: false, eta, text: `${inv.name} is already responding and will arrive in ${fmtSpoken(eta)}.` }
  }
  return { drone: inv, onScene: false, eta: null, text: `${inv.name} has been released from the response.` }
}

export function suggestSecondDrone(state: MissionState) {
  return state.drones
    .filter((d) => d.id !== state.detection.investigator && d.state.altitude > 0.5 && !['investigate', 'orbit', 'rth', 'landing'].includes(d.state.mode) && !d.linkDown)
    .sort((a, b) => dist(a.state.pos, state.detection.pos) - dist(b.state.pos, state.detection.pos))[0]
}

export function supportEffect(state: MissionState) {
  const second = suggestSecondDrone(state)
  if (!second) return null
  const sector = second.assignments[0]
  return {
    drone: second,
    text: sector ? `Sector ${sector} will pause at ${Math.round(sectorPct(sector, state.progress) * 100)}% coverage.` : `${second.name} has no active survey to pause.`,
  }
}

export function useDetectionActions() {
  const state = useMission()
  const dispatch = useDispatch()
  const support = supportEffect(state)
  return {
    continueResponse: () => dispatch({ type: 'continueResponse' }),
    sendSupport: () =>
      support && dispatch({ type: 'setProposal', proposal: interpret(`Send ${support.drone.name} to investigate the detection`, state) }),
    confirm: () => dispatch({ type: 'requestConfirm', request: { kind: 'confirm-fire' } }),
    dismiss: () => dispatch({ type: 'requestConfirm', request: { kind: 'dismiss-fire' } }),
    support,
  }
}

export function DetectionBar() {
  const state = useMission()
  const dispatch = useDispatch()
  const det = state.detection
  const actions = useDetectionActions()
  const st = investigationStatus(state)
  const selected = state.selection.type === 'detection'
  const unreviewed = det.status === 'unreviewed'
  const [expanded, setExpanded] = useState(false)

  if (det.status === 'dismissed' && state.elapsed - (det.resolvedAt ?? 0) > 20) return null

  const facts = [
    `${Math.round(det.confidence * 100)}% thermal confidence`,
    `${det.peakTemp} °C peak`,
    `Location uncertainty ±${Math.round(det.uncertainty)} m`,
    `Detected by ${state.drones.find((d) => d.id === det.detectedBy)?.name ?? 'drone'}`,
    `Detected ${fmtSpoken(state.elapsed - det.detectedAt)} ago`,
  ]
  const shortFacts = [`${Math.round(det.confidence * 100)}% conf.`, `${det.peakTemp} °C`, `±${Math.round(det.uncertainty)} m`]

  return (
    <section
      aria-label="Fire detection decision"
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-b px-2.5 py-1.5 sm:px-3 sm:py-2 lg:px-4 lg:py-2.5',
        unreviewed && 'border-caution/60 bg-[#251f12]',
        det.status === 'confirmed' && 'border-critical bg-critical/15',
        det.status === 'dismissed' && 'border-line bg-surface',
      )}
    >
      <div className="flex w-full min-w-0 items-start gap-2 lg:w-auto">
      <button
        type="button"
        onClick={() => dispatch({ type: 'select', selection: { type: 'detection' } })}
        onMouseEnter={() => dispatch({ type: 'hover', id: 'detection' })}
        onMouseLeave={() => dispatch({ type: 'hover', id: null })}
        aria-pressed={selected}
        className={cn('flex min-w-0 flex-1 items-start gap-2.5 text-left', selected && 'underline decoration-select decoration-2 underline-offset-4')}
      >
        <Flag kind={det.status === 'confirmed' ? 'critical' : 'caution'} className={cn('mt-1 scale-125', det.status === 'dismissed' && 'opacity-40 grayscale')} />
        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <span
              className={cn(
                'text-[12px] font-semibold leading-tight tracking-wide sm:text-[14px]',
                unreviewed && 'text-caution',
                det.status === 'confirmed' && 'text-critical',
                det.status === 'dismissed' && 'text-fg-muted',
              )}
            >
              {det.status === 'confirmed' ? 'CONFIRMED FIRE' : det.status === 'dismissed' ? 'Detection dismissed' : 'POSSIBLE FIRE · REVIEW REQUIRED'}
            </span>
            <span className="font-mono text-[12px] text-fg-subtle">{det.id}</span>
          </span>
          <span className={cn('text-[12px] text-fg-muted', expanded ? 'block' : 'hidden', 'lg:block')}>{facts.join(' · ')}</span>
          <span className={cn('text-[12px] text-fg-muted lg:hidden', expanded ? 'hidden' : 'block')}>
            {shortFacts.join(' · ')} · {fmtSpoken(state.elapsed - det.detectedAt)} ago
          </span>
        </span>
      </button>
        {unreviewed && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls="detection-details"
            onClick={() => setExpanded((v) => !v)}
            className="btn btn-ghost h-8 shrink-0 gap-1 px-2 text-[11px] lg:hidden"
          >
            {expanded ? 'Less' : 'Details'}
            <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
          </button>
        )}
      </div>

      {unreviewed && (
        <div
          id="detection-details"
          className="w-full text-[12px] leading-snug lg:w-auto lg:min-w-[260px] lg:flex-1 lg:border-l lg:border-line-strong lg:pl-5"
        >
          <p className="hidden text-[13px] text-fg sm:block">{st.text}</p>
          <p className={cn('text-fg-muted', expanded ? 'block' : 'hidden', 'lg:block')}>
            <span className="font-medium text-fg">Recommended:</span>{' '}
            {det.responseApproved ? `Response with ${st.drone?.name} approved.` : `Continue response with ${st.drone?.name ?? 'the responding drone'}.`}
            {actions.support && (
              <>
                {' '}
                <span className="font-medium text-fg">Alternative:</span> Send {actions.support.drone.name} as support — {actions.support.text}
              </>
            )}
          </p>
        </div>
      )}

      {!unreviewed && (
        <p className="w-full text-[13px] text-fg-muted lg:w-auto lg:flex-1 lg:border-l lg:border-line-strong lg:pl-5">
          {det.status === 'confirmed' ? 'Reported to Incident Command · overwatch holding' : 'Sector C resumed'} at{' '}
          <span className="font-mono">{clockAt(det.resolvedAt ?? 0)}</span>
        </p>
      )}

      {unreviewed && (
        <div           className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-4 lg:ml-auto lg:flex lg:w-auto lg:shrink-0 lg:items-center [&>.btn]:h-9 [&>.btn]:px-2 [&>.btn]:text-[12px] lg:[&>.btn]:h-8">
          <button type="button" className="btn btn-caution" disabled={det.responseApproved || !st.drone} onClick={actions.continueResponse}>
            {det.responseApproved ? 'Response approved' : 'Continue response'}
          </button>
          <button type="button" className="btn" disabled={!actions.support} title={actions.support ? undefined : 'No airborne drone available'} onClick={actions.sendSupport}>
            Send support
          </button>
          <button type="button" className="btn btn-danger" onClick={actions.confirm}>
            Confirm fire
          </button>
          <button type="button" className="btn btn-ghost" onClick={actions.dismiss}>
            Dismiss
          </button>
        </div>
      )}
    </section>
  )
}
