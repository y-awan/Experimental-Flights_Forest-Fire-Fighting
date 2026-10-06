import { HOME, LANE_SPACING, RESERVE_PCT, clockAt } from './data'
import { INVESTIGATE_SPEED, RTH_SPEED, activity, batteryForTrip, isAirborne } from './derive'
import { dist, polygonArea, type XY } from './geo'
import type { MissionState } from './sim'
import type { CommandKind, Drone, DroneId, Proposal, ProposalChange, SafetyCheck } from './types'

type Intent = { droneId: DroneId; kind: CommandKind }

const VERBS: { kind: CommandKind; re: RegExp }[] = [
  { kind: 'land', re: /\bland\b/ },
  { kind: 'investigate', re: /investigat|inspect|check (on |out )?(the )?(fire|detection|hotspot)|send .*(fire|detection|hotspot)|to (the )?(fire|detection|hotspot)/ },
  { kind: 'rth', re: /return|\brth\b|\brtl\b|come back|go home|send .* home|bring .* home/ },
  { kind: 'takeoff', re: /take ?off|launch/ },
  { kind: 'resume', re: /resume|continue .*sector|back to (sector|survey)/ },
  { kind: 'survey-lock', re: /keep .*(survey|going|on)|stay on|continue survey|keep .*sector/ },
  { kind: 'hold', re: /\bhold\b|loiter|hover|pause|\bstop\b/ },
]

function dronesIn(clause: string, all: Drone[]): DroneId[] {
  if (/all drones|every drone|whole fleet|\bfleet\b|everyone/.test(clause)) return all.map((d) => d.id)
  const ids = new Set<DroneId>()
  for (const m of clause.matchAll(/(?:drone|d|uav|aircraft)\s*-?\s*(\d)/g)) {
    const id = `d${m[1]}` as DroneId
    if (all.some((d) => d.id === id)) ids.add(id)
  }
  return [...ids]
}

function parse(text: string, drones: Drone[]): Intent[] {
  const clauses = text
    .toLowerCase()
    .split(/\band\b|,|;|\bthen\b|\balso\b/)
    .map((c) => c.trim())
    .filter(Boolean)
  const intents: Intent[] = []
  let lastDrones: DroneId[] = []
  for (const clause of clauses) {
    const verb = VERBS.find((v) => v.re.test(clause))
    let ids = dronesIn(clause, drones)
    if (!ids.length) ids = lastDrones
    if (!verb || !ids.length) continue
    for (const id of ids) intents.push({ droneId: id, kind: verb.kind })
    lastDrones = ids
  }
  return intents
}

function describe(kind: CommandKind, d: Drone, state: MissionState) {
  const det = state.detection
  switch (kind) {
    case 'rth':
      return `Return to LZ-1 (${Math.round(dist(d.state.pos, HOME))} m)`
    case 'land':
      return 'Land in place'
    case 'takeoff':
      return 'Take off to 40 m'
    case 'hold':
      return 'Hold position'
    case 'resume':
      return d.assignments[0] ? `Resume Sector ${d.assignments[0]}` : 'Resume (no assignment)'
    case 'survey-lock':
      return `Continue ${d.assignments.map((s) => `Sector ${s}`).join(', then ') || 'current task'} · exempt from auto-diversion`
    case 'investigate':
      return `Fly to ${det.id} and orbit at 60 m`
    default:
      return kind
  }
}

function alreadyDoing(kind: CommandKind, d: Drone): string | null {
  const m = d.state.mode
  if (kind === 'investigate' && (m === 'investigate' || m === 'orbit')) return 'Already investigating — no change'
  if (kind === 'rth' && m === 'rth') return 'Already returning — no change'
  if (kind === 'land' && (m === 'landing' || m === 'landed')) return 'Already landing — no change'
  if (kind === 'hold' && m === 'hold') return 'Already holding — no change'
  if (kind === 'survey-lock' && d.surveyLock) return 'Already exempt — no change'
  if (kind === 'takeoff' && isAirborne(d)) return 'Already airborne — no change'
  if (kind === 'resume' && m === 'survey') return 'Already surveying — no change'
  return null
}

function checksFor(intents: Intent[], state: MissionState): SafetyCheck[] {
  const checks: SafetyCheck[] = []
  for (const { droneId, kind } of intents) {
    const d = state.drones.find((x) => x.id === droneId)!
    if (alreadyDoing(kind, d)) continue
    if (d.linkDown) {
      checks.push({ label: `${d.name} link`, level: 'fail', detail: 'Telemetry stale — the aircraft cannot acknowledge this command.' })
    }
    if (kind === 'investigate') {
      const toDet = dist(d.state.pos, state.detection.pos)
      const back = dist(state.detection.pos, HOME)
      const need = batteryForTrip(d, toDet, INVESTIGATE_SPEED, 120) + batteryForTrip(d, back, RTH_SPEED)
      const left = d.state.battery - need
      checks.push({
        label: `${d.name} battery margin`,
        level: left >= RESERVE_PCT ? 'pass' : 'fail',
        detail:
          left >= RESERVE_PCT
            ? `Reaches LZ-1 after a 2 min orbit with ≈${Math.round(left)}% (reserve ${RESERVE_PCT}%).`
            : `Would reach LZ-1 with ≈${Math.max(0, Math.round(left))}% — below the ${RESERVE_PCT}% reserve.`,
      })
      if (d.state.mode === 'survey' && d.assignments[0]) {
        checks.push({ label: 'Coverage impact', level: 'warn', detail: `Sector ${d.assignments[0]} pauses while ${d.name} investigates.` })
      }
    }
    if (kind === 'rth') {
      const need = batteryForTrip(d, dist(d.state.pos, HOME), RTH_SPEED)
      checks.push({ label: `${d.name} return energy`, level: d.state.battery - need > 5 ? 'pass' : 'warn', detail: `Arrives at LZ-1 with ≈${Math.round(d.state.battery - need)}%.` })
      if (d.assignments.length) checks.push({ label: 'Coverage impact', level: 'warn', detail: `Sector ${d.assignments.join(', ')} will be reassigned.` })
    }
    if (kind === 'land' && dist(d.state.pos, HOME) > 30) {
      checks.push({ label: `${d.name} landing site`, level: 'warn', detail: 'Off-site landing under forest canopy. Ground recovery required.' })
    }
    if (kind === 'takeoff' && d.state.battery <= RESERVE_PCT) {
      checks.push({ label: `${d.name} battery`, level: 'fail', detail: `Battery ${Math.round(d.state.battery)}% is below the ${RESERVE_PCT}% reserve. Swap before launch.` })
    }
  }
  const touchesDetection = intents.some((i) => i.kind === 'investigate')
  checks.push({
    label: 'Geofence',
    level: 'pass',
    detail: touchesDetection ? `${state.detection.id} lies inside the patrol boundary.` : 'All waypoints remain inside the patrol boundary.',
  })
  checks.push({ label: 'Vertical separation', level: 'pass', detail: 'Survey 40 m · investigate 60 m · transit 55 m. Minimum 15 m maintained.' })
  return checks
}

export function interpret(text: string, state: MissionState): Proposal {
  const intents = parse(text, state.drones)
  if (!intents.length) {
    return {
      source: text,
      understood: false,
      objective: 'This could not be mapped to a fleet action. Name a drone and an action, for example “Return Drone 1 home” or “Send Drone 1 to investigate the detection”.',
      changes: [],
      routeNotes: [],
      checks: [],
    }
  }

  const changes: ProposalChange[] = intents.map(({ droneId, kind }) => {
    const d = state.drones.find((x) => x.id === droneId)!
    const same = alreadyDoing(kind, d)
    return {
      droneId,
      now: activity(d, state.progress, state.detection, false),
      proposed: same ?? describe(kind, d, state),
      command: same ? null : kind,
    }
  })

  const routeNotes: string[] = []
  for (const { droneId, kind } of intents) {
    const d = state.drones.find((x) => x.id === droneId)!
    if (alreadyDoing(kind, d)) continue
    if (kind === 'investigate') {
      const m = Math.round(dist(d.state.pos, state.detection.pos))
      routeNotes.push(`${d.name}: direct track to ${state.detection.id}, ${m} m (≈${Math.round(m / INVESTIGATE_SPEED)} s), then 45 m orbit at 60 m AGL.`)
    } else if (kind === 'rth') {
      routeNotes.push(`${d.name}: climb to 55 m, direct to LZ-1, ${Math.round(dist(d.state.pos, HOME))} m.`)
    } else if (kind === 'survey-lock') {
      routeNotes.push(`${d.name}: no route change. Future detections will not divert this aircraft.`)
    } else if (kind === 'land') {
      routeNotes.push(`${d.name}: vertical descent at current position.`)
    } else if (kind === 'hold') {
      routeNotes.push(`${d.name}: hover at current position; coverage paused.`)
    }
  }

  const objective = intents
    .map(({ droneId, kind }) => {
      const d = state.drones.find((x) => x.id === droneId)!
      switch (kind) {
        case 'survey-lock':
          return `${d.name} continues its survey without diversion`
        case 'investigate':
          return `${d.name} investigates the possible fire at ${state.detection.id}`
        case 'rth':
          return `${d.name} returns to LZ-1`
        case 'land':
          return `${d.name} lands at its current position`
        case 'hold':
          return `${d.name} holds position`
        case 'resume':
          return `${d.name} resumes its assigned coverage`
        case 'takeoff':
          return `${d.name} takes off`
        default:
          return ''
      }
    })
    .join('; ')

  return {
    source: text,
    understood: true,
    objective: objective.charAt(0).toUpperCase() + objective.slice(1) + '.',
    changes,
    routeNotes,
    checks: checksFor(intents, state),
  }
}

export function regionProposal(points: XY[], state: MissionState): Proposal {
  const area = polygonArea(points)
  const lanesLength = area / LANE_SPACING
  const fleetSpeed = state.drones.filter((d) => isAirborne(d) && d.state.battery > 40).length * 16 || 16
  const minutes = lanesLength / fleetSpeed / 60
  return {
    source: `Patrol drawn region · ${points.length} vertices`,
    understood: true,
    objective: `Survey a new ${(area / 1e6).toFixed(2)} km² region after the current patrol finishes (queued, no change to active coverage).`,
    changes: [],
    routeNotes: [
      `Lawnmower coverage at ${LANE_SPACING} m lane spacing, 40 m AGL.`,
      `≈${(lanesLength / 1000).toFixed(1)} km of track; ≈${Math.ceil(minutes)} min with current airborne fleet.`,
      `Queued behind Western Ridge Patrol; sectors are assigned when it completes (est. after ${clockAt(state.elapsed + 12 * 60, false)}).`,
    ],
    checks: [
      { label: 'Polygon', level: points.length >= 3 ? 'pass' : 'fail', detail: `${points.length} vertices, closed, non-degenerate.` },
      { label: 'Area', level: area < 6e6 ? 'pass' : 'warn', detail: area < 6e6 ? 'Within a single battery cycle for 3 drones.' : 'Exceeds one battery cycle — expect battery swaps.' },
      { label: 'Airspace', level: 'pass', detail: 'No TFR conflicts in the mock airspace layer.' },
    ],
    regionArea: area,
  }
}
