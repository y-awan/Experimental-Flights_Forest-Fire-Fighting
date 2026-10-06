import {
  BOUNDARY,
  CRITICAL_PCT,
  FAILSAFE_AFTER,
  HOME,
  INITIAL_DETECTION,
  INITIAL_DRONES,
  INITIAL_ELAPSED,
  INITIAL_EVENTS,
  INITIAL_PROGRESS,
  RESERVE_PCT,
  SECTORS,
  clockAt,
} from './data'
import { INVESTIGATE_ALT, INVESTIGATE_SPEED, ORBIT_RADIUS, RTH_SPEED, isAirborne } from './derive'
import { dist, headingDeg, moveToward, pointAlong, type XY } from './geo'
import type {
  Command,
  CommandKind,
  ConfirmRequest,
  Detection,
  Drone,
  DroneId,
  EventKind,
  EventTarget,
  FocusRequest,
  MapLayers,
  MissionEvent,
  Proposal,
  SectorId,
  Selection,
} from './types'

export type OpsMode = 'simulation' | 'live'

export type MissionState = {
  mode: OpsMode
  paused: boolean
  speed: 1 | 2 | 4
  elapsed: number
  drones: Drone[]
  progress: Record<SectorId, number>
  detection: Detection
  commands: Command[]
  events: MissionEvent[]
  selection: Selection
  focus: FocusRequest | null
  layers: MapLayers
  timelineOpen: boolean
  proposal: Proposal | null
  confirm: ConfirmRequest | null
  draft: { drawing: boolean; points: XY[] }
  region: XY[] | null
  queuedRegions: XY[][]
  hover: string | null
  basemap: 'topo' | 'imagery'
  composer: string
}

export const initialState: MissionState = {
  mode: 'simulation',
  paused: false,
  speed: 1,
  elapsed: INITIAL_ELAPSED,
  drones: INITIAL_DRONES,
  progress: INITIAL_PROGRESS,
  detection: INITIAL_DETECTION,
  commands: [],
  events: INITIAL_EVENTS,
  selection: { type: 'mission' },
  focus: null,
  layers: { planned: true, completed: true, sectors: true, trails: true },
  timelineOpen: false,
  proposal: null,
  confirm: null,
  draft: { drawing: false, points: [] },
  region: null,
  queuedRegions: [],
  hover: null,
  basemap: 'topo',
  composer: '',
}

export type Action =
  | { type: 'tick'; dt: number }
  | { type: 'select'; selection: Selection; focus?: boolean }
  | { type: 'hover'; id: string | null }
  | { type: 'focus'; focus: FocusRequest extends infer F ? (F extends FocusRequest ? Omit<F, 'nonce'> : never) : never }
  | { type: 'setSpeed'; speed: 1 | 2 | 4 }
  | { type: 'togglePause' }
  | { type: 'toggleLayer'; layer: keyof MapLayers }
  | { type: 'toggleTimeline'; open?: boolean }
  | { type: 'setBasemap'; basemap: 'topo' | 'imagery' }
  | { type: 'requestConfirm'; request: ConfirmRequest }
  | { type: 'cancelConfirm' }
  | { type: 'acceptConfirm' }
  | { type: 'retryCommand'; id: string }
  | { type: 'clearCommand'; id: string }
  | { type: 'toggleLink'; droneId: DroneId }
  | { type: 'swapBattery'; droneId: DroneId }
  | { type: 'setProposal'; proposal: Proposal }
  | { type: 'approveProposal' }
  | { type: 'closeProposal'; keepText?: boolean }
  | { type: 'setComposer'; text: string }
  | { type: 'startDraw' }
  | { type: 'addPoint'; point: XY }
  | { type: 'undoPoint' }
  | { type: 'finishDraw' }
  | { type: 'cancelDraw' }
  | { type: 'discardRegion' }
  | { type: 'setMode'; mode: OpsMode }
  | { type: 'continueResponse' }

let seq = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`

const COMMAND_LABEL: Record<CommandKind, string> = {
  rth: 'Return home',
  land: 'Land now',
  'cancel-rth': 'Cancel return',
  takeoff: 'Take off',
  hold: 'Hold position',
  resume: 'Resume survey',
  'survey-lock': 'Keep surveying',
  investigate: 'Investigate detection',
}

export function commandLabel(kind: CommandKind) {
  return COMMAND_LABEL[kind]
}

function event(state: MissionState, text: string, severity: MissionEvent['severity'], target: EventTarget, kind?: EventKind): MissionEvent {
  return { id: uid('e'), t: state.elapsed, text, severity, target, kind }
}

function droneById(drones: Drone[], id: DroneId) {
  return drones.find((d) => d.id === id)!
}

function focusFor(state: MissionState, selection: Selection): FocusRequest | null {
  const nonce = Date.now() + Math.random()
  if (selection.type === 'drone') return { nonce, kind: 'point', pos: droneById(state.drones, selection.id).reported.pos }
  if (selection.type === 'detection') return { nonce, kind: 'point', pos: state.detection.pos }
  if (selection.type === 'sector') return { nonce, kind: 'bounds', points: SECTORS[selection.id].polygon }
  return null
}

function reassign(drones: Drone[], from: Drone): { drones: Drone[]; to: Drone | null; sectors: SectorId[] } {
  const sectors = from.assignments
  if (!sectors.length) return { drones, to: null, sectors }
  const candidates = drones
    .filter((d) => d.id !== from.id && isAirborne(d) && d.state.battery > RESERVE_PCT + 15 && !d.linkDown)
    .sort((a, b) => b.state.battery - a.state.battery)
  const to = candidates[0] ?? null
  const next = drones.map((d) => {
    if (d.id === from.id) return { ...d, assignments: [], released: sectors }
    if (to && d.id === to.id) return { ...d, assignments: [...d.assignments, ...sectors.filter((s) => !d.assignments.includes(s))] }
    return d
  })
  return { drones: next, to, sectors }
}

function applyCommand(state: MissionState, cmd: Command): MissionState {
  let drones = state.drones
  let events = state.events
  let detection = state.detection
  const drone = droneById(drones, cmd.droneId)
  const at = clockAt(state.elapsed)
  const patch = (p: Partial<Drone>) => {
    drones = drones.map((d) => (d.id === cmd.droneId ? { ...d, ...p, state: { ...d.state, ...(p.state ?? {}) } } : d))
  }

  switch (cmd.kind) {
    case 'rth': {
      const r = reassign(drones, drone)
      drones = r.drones
      const note = r.sectors.length
        ? r.to
          ? `Remaining Sector ${r.sectors.join(' and ')} coverage moves to ${r.to.name}.`
          : `Sector ${r.sectors.join(' and ')} is unassigned until a drone is available.`
        : 'No survey coverage is affected.'
      patch({
        state: { ...drone.state, mode: 'rth' },
        reason: {
          trigger: `Operator commanded Return home at ${at}.`,
          rule: 'Climb to 55 m transit altitude, fly direct to LZ-1, then land.',
          effect: note,
          override: 'Cancel return or Land now.',
        },
      })
      if (r.to) events = [...events, event(state, `Sector ${r.sectors.join(', ')} reassigned to ${r.to.name}`, 'info', { type: 'drone', id: r.to.id })]
      break
    }
    case 'land':
      patch({
        state: { ...drone.state, mode: 'landing' },
        reason: {
          trigger: `Operator commanded Land now at ${at}.`,
          rule: 'Descend vertically at 2 m/s at the current position.',
          effect: dist(drone.state.pos, HOME) < 30 ? 'Landing at LZ-1.' : 'Landing off-site; ground recovery will be required.',
        },
      })
      break
    case 'cancel-rth': {
      const take = drone.released
      drones = drones.map((d) => (d.id !== drone.id ? { ...d, assignments: d.assignments.filter((s) => !take.includes(s) || d.assignments[0] === s) } : d))
      patch({
        assignments: take,
        released: [],
        reserveOverride: true,
        state: { ...drone.state, mode: take.length ? 'survey' : 'hold' },
        reason: {
          trigger: `Operator cancelled the return at ${at}.`,
          rule: `The ${RESERVE_PCT}% reserve rule is suppressed for this aircraft until it lands.`,
          effect: take.length ? `Resuming Sector ${take.join(', ')}. Forced landing still occurs at ${CRITICAL_PCT}%.` : 'Holding position.',
        },
      })
      break
    }
    case 'takeoff':
      patch({
        reserveOverride: false,
        state: { ...drone.state, mode: 'takeoff' },
        reason: {
          trigger: `Operator commanded Take off at ${at}.`,
          rule: 'Climb vertically to 40 m, then resume any assigned coverage.',
          effect: drone.assignments.length ? `Resumes Sector ${drone.assignments[0]}.` : 'Holds over LZ-1 awaiting assignment.',
        },
      })
      break
    case 'hold':
      patch({
        state: { ...drone.state, mode: 'hold' },
        reason: { trigger: `Operator commanded Hold at ${at}.`, rule: 'Hover at current position and altitude.', effect: 'Assigned coverage is paused.' },
      })
      break
    case 'resume':
      patch({
        state: { ...drone.state, mode: drone.assignments.length ? 'survey' : 'hold' },
        reason: { trigger: `Operator commanded Resume at ${at}.`, rule: 'Continue assigned lawnmower coverage.', effect: drone.assignments.length ? `Resuming Sector ${drone.assignments[0]}.` : 'No assignment to resume.' },
      })
      break
    case 'survey-lock':
      patch({
        surveyLock: true,
        reason: {
          trigger: `Operator approved "Keep surveying" at ${at}.`,
          rule: 'This aircraft is exempt from automatic diversion to new detections.',
          effect: `Continues ${drone.assignments.map((s) => `Sector ${s}`).join(', then ') || 'its current task'}.`,
        },
      })
      break
    case 'investigate':
      patch({
        state: { ...drone.state, mode: 'investigate' },
        reason: {
          trigger: `Operator sent ${drone.name} to ${detection.id} at ${at}.`,
          rule: 'Fly direct at 60 m, then orbit the detection at 45 m radius.',
          effect: drone.assignments.length ? `Sector ${drone.assignments[0]} pauses until the detection is resolved.` : 'No coverage is affected.',
        },
      })
      if (!detection.investigator) detection = { ...detection, investigator: drone.id }
      break
  }
  return { ...state, drones, events, detection }
}

function isCommandDone(state: MissionState, cmd: Command): boolean {
  const d = droneById(state.drones, cmd.droneId)
  const since = state.elapsed - (cmd.stamps.executing ?? state.elapsed)
  switch (cmd.kind) {
    case 'rth':
    case 'land':
      return d.state.mode === 'landed'
    case 'takeoff':
      return d.state.mode !== 'takeoff' && d.state.altitude >= 38
    case 'investigate':
      return d.state.mode === 'orbit'
    default:
      return since >= 1.2
  }
}

function stepCommands(state: MissionState): MissionState {
  let next = state
  const commands = state.commands.map((c) => ({ ...c, stamps: { ...c.stamps } }))
  for (const c of commands) {
    const d = droneById(next.drones, c.droneId)
    const now = next.elapsed
    if (c.stage === 'proposed' && now - (c.stamps.proposed ?? now) >= 0.3) {
      c.stage = 'sent'
      c.stamps.sent = now
    } else if (c.stage === 'sent') {
      if (d.linkDown) {
        if (now - (c.stamps.sent ?? now) >= 5) {
          c.stage = 'failed'
          c.failure = 'No acknowledgement after 5 s · telemetry link stale'
          next = { ...next, events: [...next.events, event(next, `${d.name} did not acknowledge "${c.label}"`, 'critical', { type: 'drone', id: d.id })] }
        }
      } else if (now - (c.stamps.sent ?? now) >= 0.8) {
        c.stage = 'acknowledged'
        c.stamps.acknowledged = now
      }
    } else if (c.stage === 'acknowledged' && now - (c.stamps.acknowledged ?? now) >= 0.6) {
      for (const other of commands) {
        if (other !== c && other.droneId === c.droneId && other.stage === 'executing') {
          other.stage = 'failed'
          other.failure = `Superseded by "${c.label}"`
        }
      }
      c.stage = 'executing'
      c.stamps.executing = now
      next = applyCommand(next, c)
      next = { ...next, events: [...next.events, event(next, `${d.name} executing "${c.label}"`, 'operator', { type: 'drone', id: d.id })] }
    } else if (c.stage === 'executing' && isCommandDone(next, c)) {
      c.stage = 'completed'
      c.stamps.completed = now
    }
  }
  return { ...next, commands }
}

function issue(state: MissionState, droneId: DroneId, kind: CommandKind, origin: Command['origin']): MissionState {
  const drone = droneById(state.drones, droneId)
  const cmd: Command = {
    id: uid('c'),
    droneId,
    kind,
    label: COMMAND_LABEL[kind],
    stage: 'proposed',
    stamps: { proposed: state.elapsed },
    origin,
  }
  return {
    ...state,
    commands: [...state.commands.filter((c) => !(c.droneId === droneId && (c.stage === 'completed' || c.stage === 'failed'))), cmd],
    events: [...state.events, event(state, `Operator: "${cmd.label}" → ${drone.name}`, 'operator', { type: 'drone', id: droneId })],
  }
}

function stepDrones(state: MissionState, dt: number): MissionState {
  let progress = { ...state.progress }
  let events = state.events
  let detection = state.detection
  let drones = state.drones.map((d) => ({ ...d, state: { ...d.state } }))
  const pendingReassign: DroneId[] = []

  drones = drones.map((d, idx) => {
    const s = d.state
    let { pos, heading, altitude, groundspeed, mode } = s
    let battery = s.battery
    let orbitAngle = d.orbitAngle
    let assignments = d.assignments
    let reason = d.reason
    let failsafeTriggered = d.failsafeTriggered

    const climb = (target: number) => {
      const step = 2.5 * dt
      altitude = Math.abs(target - altitude) <= step ? target : altitude + Math.sign(target - altitude) * step
    }

    switch (mode) {
      case 'survey': {
        const sector = assignments[0]
        if (!sector) {
          mode = 'hold'
          groundspeed = 0
          break
        }
        const sec = SECTORS[sector]
        const target = pointAlong(sec.path, progress[sector])
        climb(40)
        if (dist(pos, target.p) > 10) {
          const m = moveToward(pos, target.p, d.surveySpeed * dt)
          heading = headingDeg(pos, target.p)
          pos = m.p
          groundspeed = d.surveySpeed
        } else {
          const s2 = Math.min(sec.length, progress[sector] + d.surveySpeed * dt)
          progress = { ...progress, [sector]: s2 }
          const at = pointAlong(sec.path, s2)
          pos = at.p
          heading = at.heading
          groundspeed = d.surveySpeed
          if (s2 >= sec.length) {
            assignments = assignments.slice(1)
            events = [...events, event(state, `Sector ${sector} coverage complete · ${d.name}`, 'info', { type: 'sector', id: sector })]
            if (!assignments.length) {
              mode = 'rth'
              reason = {
                trigger: `All assigned coverage finished at ${clockAt(state.elapsed)}.`,
                rule: 'Drones with no remaining assignment return to LZ-1.',
                effect: 'Returning home to land.',
              }
              events = [...events, event(state, `${d.name} returning home · assignments complete`, 'info', { type: 'drone', id: d.id })]
            }
          }
        }
        break
      }
      case 'rth': {
        climb(55)
        const m = moveToward(pos, HOME, RTH_SPEED * dt)
        if (!m.arrived) heading = headingDeg(pos, HOME)
        pos = m.p
        groundspeed = m.arrived ? 0 : RTH_SPEED
        if (m.arrived) mode = 'landing'
        break
      }
      case 'landing': {
        groundspeed = 0
        altitude = Math.max(0, altitude - 2 * dt)
        if (altitude === 0) {
          mode = 'landed'
          events = [...events, event(state, `${d.name} landed${dist(pos, HOME) < 30 ? ' at LZ-1' : ' off-site'} · ${Math.round(battery)}%`, 'info', { type: 'drone', id: d.id })]
        }
        break
      }
      case 'landed':
        groundspeed = 0
        break
      case 'takeoff':
        groundspeed = 0
        altitude = Math.min(40, altitude + 3 * dt)
        if (altitude >= 40) mode = assignments.length ? 'survey' : 'hold'
        break
      case 'investigate': {
        climb(INVESTIGATE_ALT)
        const toDet = dist(pos, detection.pos)
        if (toDet <= ORBIT_RADIUS + 1) {
          mode = 'orbit'
          orbitAngle = Math.atan2(pos.x - detection.pos.x, pos.y - detection.pos.y) + idx
          if (!detection.arrivedAt) {
            detection = { ...detection, arrivedAt: state.elapsed, uncertainty: 6 }
            events = [
              ...events,
              event(state, `${d.name} on scene · orbiting ${detection.id} at 60 m`, 'info', { type: 'drone', id: d.id }),
              event(state, 'Close-range pass refined location to ±6 m', 'info', { type: 'detection' }),
            ]
          }
        } else {
          const goal = {
            x: detection.pos.x + ((pos.x - detection.pos.x) / toDet) * ORBIT_RADIUS,
            y: detection.pos.y + ((pos.y - detection.pos.y) / toDet) * ORBIT_RADIUS,
          }
          heading = headingDeg(pos, detection.pos)
          pos = moveToward(pos, goal, INVESTIGATE_SPEED * dt).p
          groundspeed = INVESTIGATE_SPEED
        }
        break
      }
      case 'orbit': {
        climb(INVESTIGATE_ALT)
        const omega = 6 / ORBIT_RADIUS
        orbitAngle += omega * dt
        const np = { x: detection.pos.x + Math.sin(orbitAngle) * ORBIT_RADIUS, y: detection.pos.y + Math.cos(orbitAngle) * ORBIT_RADIUS }
        heading = headingDeg(pos, np)
        pos = np
        groundspeed = 6
        break
      }
      case 'hold':
        groundspeed = 0
        break
    }

    if (altitude > 0.5) battery = Math.max(0, battery - d.drainPerSec * dt)

    const flying = altitude > 0.5 && mode !== 'landing' && mode !== 'takeoff'
    if (flying && battery <= RESERVE_PCT && !d.reserveOverride && mode !== 'rth') {
      mode = 'rth'
      reason = {
        trigger: `Battery reached the ${RESERVE_PCT}% reserve threshold at ${clockAt(state.elapsed)}.`,
        rule: 'A drone at reserve stops its task and returns to LZ-1 with enough charge to land.',
        effect: assignments.length ? 'Remaining coverage is reassigned to the drone with the most margin.' : 'No coverage is affected.',
        override: 'Cancel return suppresses the reserve rule until landing.',
      }
      events = [...events, event(state, `${d.name} reached ${RESERVE_PCT}% reserve · automatic return`, 'warning', { type: 'drone', id: d.id })]
      pendingReassign.push(d.id)
    }
    if (flying && battery <= CRITICAL_PCT - 2) {
      mode = 'landing'
      reason = {
        trigger: `Battery fell to ${Math.round(battery)}% at ${clockAt(state.elapsed)}.`,
        rule: `Below ${CRITICAL_PCT - 2}% the aircraft lands in place regardless of operator overrides.`,
        effect: 'Forced landing in progress. Ground recovery required.',
      }
      events = [...events, event(state, `${d.name} forced landing · battery ${Math.round(battery)}%`, 'critical', { type: 'drone', id: d.id })]
    }
    if (d.linkDown && d.linkDownAt !== null && state.elapsed - d.linkDownAt >= FAILSAFE_AFTER && !failsafeTriggered && flying && mode !== 'rth') {
      failsafeTriggered = true
      mode = 'rth'
      reason = {
        trigger: `No ground link for ${FAILSAFE_AFTER} s.`,
        rule: 'On sustained link loss the aircraft returns to LZ-1 autonomously.',
        effect: 'Expected to be returning home. Position shown is the last report.',
      }
      events = [...events, event(state, `${d.name} link-loss failsafe expected · return to LZ-1`, 'critical', { type: 'drone', id: d.id })]
      pendingReassign.push(d.id)
    }

    const next: Drone = {
      ...d,
      assignments,
      reason,
      orbitAngle,
      failsafeTriggered,
      state: { pos, heading, altitude, groundspeed, battery, mode },
    }
    if (!d.linkDown) {
      next.reported = { ...next.state }
      next.reportedAt = state.elapsed
    }
    if (state.elapsed - d.lastTrailAt >= 1 && !d.linkDown && altitude > 0.5) {
      next.trail = [...d.trail, { ...pos }].slice(-45)
      next.lastTrailAt = state.elapsed
    }
    return next
  })

  for (const id of pendingReassign) {
    const from = droneById(drones, id)
    const r = reassign(drones, from)
    drones = r.drones
    if (r.to) events = [...events, event(state, `Sector ${r.sectors.join(', ')} reassigned to ${r.to.name}`, 'info', { type: 'drone', id: r.to.id })]
  }

  return { ...state, drones, progress, events, detection }
}

function resolveDetection(state: MissionState, status: 'confirmed' | 'dismissed'): MissionState {
  let drones = state.drones
  let events = state.events
  const at = clockAt(state.elapsed)
  if (status === 'confirmed') {
    drones = drones.map((d) =>
      d.state.mode === 'investigate' || d.state.mode === 'orbit'
        ? {
            ...d,
            reason: {
              trigger: `Operator confirmed fire ${state.detection.id} at ${at}.`,
              rule: 'Hold a 45 m orbit over confirmed fires to maintain live imagery.',
              effect: `Sector ${d.assignments[0] ?? '—'} stays paused while overwatch continues.`,
              override: 'Return home or Resume survey to release overwatch.',
            },
          }
        : d,
    )
    events = [...events, event(state, `Operator confirmed fire ${state.detection.id} · reported to Incident Command`, 'critical', { type: 'detection' }, 'detection')]
  } else {
    drones = drones.map((d) =>
      d.state.mode === 'investigate' || d.state.mode === 'orbit'
        ? {
            ...d,
            state: { ...d.state, mode: d.assignments.length ? 'survey' : 'rth' },
            reason: {
              trigger: `Operator dismissed ${state.detection.id} as a false positive at ${at}.`,
              rule: 'Investigating drones resume their prior assignment.',
              effect: d.assignments.length ? `Resuming Sector ${d.assignments[0]} from ${Math.round((state.progress[d.assignments[0]] / SECTORS[d.assignments[0]].length) * 100)}%.` : 'Returning home.',
            },
          }
        : d,
    )
    events = [...events, event(state, `Operator dismissed ${state.detection.id} · Sector C resumes`, 'operator', { type: 'detection' }, 'detection')]
  }
  return { ...state, drones, events, detection: { ...state.detection, status, resolvedAt: state.elapsed } }
}

export function reducer(state: MissionState, action: Action): MissionState {
  switch (action.type) {
    case 'tick': {
      if (state.paused) return state
      const dt = action.dt * (state.mode === 'live' ? 1 : state.speed)
      let next: MissionState = { ...state, elapsed: state.elapsed + dt }
      next = stepDrones(next, dt)
      next = stepCommands(next)
      return next
    }
    case 'select': {
      const focus = action.focus === false ? state.focus : (focusFor(state, action.selection) ?? state.focus)
      return { ...state, selection: action.selection, focus }
    }
    case 'hover':
      return { ...state, hover: action.id }
    case 'focus':
      return { ...state, focus: { ...action.focus, nonce: Date.now() + Math.random() } as FocusRequest }
    case 'setSpeed':
      return { ...state, speed: action.speed }
    case 'togglePause':
      return { ...state, paused: !state.paused }
    case 'toggleLayer':
      return { ...state, layers: { ...state.layers, [action.layer]: !state.layers[action.layer] } }
    case 'toggleTimeline':
      return { ...state, timelineOpen: action.open ?? !state.timelineOpen }
    case 'setBasemap':
      return { ...state, basemap: action.basemap }
    case 'requestConfirm':
      return { ...state, confirm: action.request }
    case 'cancelConfirm':
      return { ...state, confirm: null }
    case 'acceptConfirm': {
      const req = state.confirm
      if (!req) return state
      const cleared = { ...state, confirm: null }
      if (req.kind === 'command') return issue(cleared, req.droneId, req.command, 'operator')
      if (req.kind === 'confirm-fire') return resolveDetection(cleared, 'confirmed')
      if (req.kind === 'dismiss-fire') return resolveDetection(cleared, 'dismissed')
      if (req.kind === 'go-live')
        return {
          ...cleared,
          mode: 'live',
          paused: false,
          speed: 1,
          drones: cleared.drones.map((d) => (d.linkDown ? { ...d, linkDown: false, linkDownAt: null } : d)),
          events: [...cleared.events, event(cleared, 'Console switched to LIVE operation', 'critical', { type: 'mission' })],
        }
      return cleared
    }
    case 'retryCommand': {
      const c = state.commands.find((x) => x.id === action.id)
      if (!c) return state
      return issue(state, c.droneId, c.kind, c.origin)
    }
    case 'clearCommand':
      return { ...state, commands: state.commands.filter((c) => c.id !== action.id) }
    case 'toggleLink': {
      const drones = state.drones.map((d) =>
        d.id === action.droneId
          ? d.linkDown
            ? { ...d, linkDown: false, linkDownAt: null }
            : { ...d, linkDown: true, linkDownAt: state.elapsed }
          : d,
      )
      const d = droneById(drones, action.droneId)
      return {
        ...state,
        drones,
        events: [...state.events, event(state, d.linkDown ? `${d.name} telemetry dropout injected (simulation)` : `${d.name} telemetry link restored`, d.linkDown ? 'warning' : 'info', { type: 'drone', id: d.id })],
      }
    }
    case 'swapBattery': {
      const drones = state.drones.map((d) =>
        d.id === action.droneId ? { ...d, state: { ...d.state, battery: 100 }, reported: { ...d.reported, battery: 100 } } : d,
      )
      const d = droneById(drones, action.droneId)
      return { ...state, drones, events: [...state.events, event(state, `${d.name} battery swapped · 100%`, 'info', { type: 'drone', id: d.id })] }
    }
    case 'setProposal':
      return { ...state, proposal: action.proposal, selection: { type: 'proposal' } }
    case 'approveProposal': {
      const p = state.proposal
      if (!p) return state
      let next: MissionState = { ...state, proposal: null, composer: '', selection: { type: 'mission' } }
      for (const ch of p.changes) if (ch.command) next = issue(next, ch.droneId, ch.command, 'proposal')
      if (p.regionArea && state.region) {
        next = {
          ...next,
          queuedRegions: [...next.queuedRegions, state.region],
          region: null,
          events: [...next.events, event(next, `Patrol region ${next.queuedRegions.length + 2} queued after current patrol`, 'operator', { type: 'mission' })],
        }
      }
      return next
    }
    case 'closeProposal':
      return {
        ...state,
        proposal: null,
        composer: action.keepText ? (state.proposal?.source ?? state.composer) : state.composer,
        selection: state.proposal?.regionArea ? { type: 'region' } : { type: 'mission' },
      }
    case 'setComposer':
      return { ...state, composer: action.text }
    case 'startDraw':
      return { ...state, draft: { drawing: true, points: [] }, region: null }
    case 'addPoint':
      return state.draft.drawing ? { ...state, draft: { ...state.draft, points: [...state.draft.points, action.point] } } : state
    case 'undoPoint':
      return { ...state, draft: { ...state.draft, points: state.draft.points.slice(0, -1) } }
    case 'finishDraw':
      if (state.draft.points.length < 3) return state
      return { ...state, draft: { drawing: false, points: [] }, region: state.draft.points, selection: { type: 'region' } }
    case 'cancelDraw':
      return { ...state, draft: { drawing: false, points: [] } }
    case 'discardRegion':
      return { ...state, region: null, selection: { type: 'mission' } }
    case 'setMode':
      return {
        ...state,
        mode: action.mode,
        events: [...state.events, event(state, action.mode === 'live' ? 'Console switched to LIVE operation' : 'Console returned to SIMULATION', 'operator', { type: 'mission' })],
      }
    case 'continueResponse': {
      const inv = state.drones.find((d) => d.id === state.detection.investigator)
      if (!inv || state.detection.responseApproved) return state
      return {
        ...state,
        detection: { ...state.detection, responseApproved: true },
        events: [...state.events, event(state, `Operator approved ${inv.name} response to ${state.detection.id}`, 'operator', { type: 'detection' }, 'command')],
      }
    }
  }
}

export const MISSION_BOUNDS = BOUNDARY
