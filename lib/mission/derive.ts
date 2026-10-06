import { CRITICAL_PCT, HOME, LINK_LOST_AFTER, RESERVE_PCT, SECTORS, STALE_AFTER } from './data'
import { dist, pointAlong, type XY } from './geo'
import type { Command, Detection, Drone, SectorId } from './types'

export const ORBIT_RADIUS = 45
export const INVESTIGATE_SPEED = 11.5
export const RTH_SPEED = 8
export const INVESTIGATE_ALT = 60

export type Health = {
  level: 'nominal' | 'caution' | 'critical'
  stale: boolean
  linkLost: boolean
  age: number
  airborne: boolean
  issue: string | null
}

export function telemetryAge(drone: Drone, elapsed: number, index = 0) {
  if (!drone.linkDown) return 0.2 + 0.3 * Math.abs(Math.sin(elapsed * 1.7 + index * 2.1))
  return Math.max(0, elapsed - drone.reportedAt)
}

export function droneHealth(drone: Drone, elapsed: number, index = 0): Health {
  const age = telemetryAge(drone, elapsed, index)
  const r = drone.reported
  const airborne = r.altitude > 0.5
  const stale = age >= STALE_AFTER
  const linkLost = age >= LINK_LOST_AFTER
  let level: Health['level'] = 'nominal'
  let issue: string | null = null
  if (airborne && r.battery <= RESERVE_PCT) {
    level = 'caution'
    issue = drone.reserveOverride ? `Below ${RESERVE_PCT}% reserve · return cancelled` : `Low battery · below ${RESERVE_PCT}% reserve`
  }
  if (stale) {
    issue = linkLost ? `Link lost · last report ${Math.floor(age)} s ago` : `Telemetry stale · ${age.toFixed(0)} s`
  }
  if (airborne && r.battery <= CRITICAL_PCT) {
    level = 'critical'
    issue = `Battery critical · ${Math.round(r.battery)}%`
  }
  if (linkLost) level = 'critical'
  return { level, stale, linkLost, age, airborne, issue }
}

export function surveyTarget(drone: Drone, progress: Record<SectorId, number>): XY | null {
  const sector = drone.assignments[0]
  if (!sector) return null
  return pointAlong(SECTORS[sector].path, progress[sector]).p
}

export function activity(drone: Drone, progress: Record<SectorId, number>, detection: Detection, useReported = true) {
  const s = useReported ? drone.reported : drone.state
  switch (s.mode) {
    case 'survey': {
      const sector = drone.assignments[0]
      if (!sector) return 'Holding · no assignment'
      const target = surveyTarget(drone, progress)
      if (target && dist(s.pos, target) > 12) return `Transiting to Sector ${sector}`
      return `Surveying Sector ${sector}`
    }
    case 'rth':
      return drone.failsafeTriggered ? 'Returning home · link failsafe' : 'Returning home'
    case 'landing':
      return dist(s.pos, HOME) < 30 ? 'Landing at LZ-1' : 'Landing in place'
    case 'landed':
      return dist(s.pos, HOME) < 30 ? 'Landed at LZ-1' : 'Landed off-site'
    case 'takeoff':
      return 'Taking off'
    case 'investigate':
      return 'Investigating fire detection'
    case 'orbit':
      return detection.status === 'confirmed' ? 'Holding over confirmed fire' : 'Orbiting fire detection'
    case 'hold':
      return 'Holding position'
  }
}

export type NextPoint = { label: string; distance: number; eta: number } | null

export function nextWaypoint(drone: Drone, progress: Record<SectorId, number>, detection: Detection): NextPoint {
  const s = drone.reported
  switch (s.mode) {
    case 'survey': {
      const sector = drone.assignments[0]
      if (!sector) return null
      const path = SECTORS[sector].path
      const target = pointAlong(path, progress[sector])
      if (dist(s.pos, target.p) > 12) {
        const d = dist(s.pos, target.p)
        return { label: `Sector ${sector} entry`, distance: d, eta: d / drone.surveySpeed }
      }
      const wp = path[Math.min(target.index, path.length - 1)]
      const d = dist(s.pos, wp)
      return { label: `${sector}-WP${String(target.index).padStart(2, '0')}`, distance: d, eta: d / drone.surveySpeed }
    }
    case 'rth': {
      const d = dist(s.pos, HOME)
      return { label: 'LZ-1 Ridge Road', distance: d, eta: d / RTH_SPEED }
    }
    case 'investigate': {
      const d = Math.max(0, dist(s.pos, detection.pos) - ORBIT_RADIUS)
      return { label: detection.id, distance: d, eta: d / INVESTIGATE_SPEED }
    }
    case 'landing':
      return { label: 'Touchdown', distance: s.altitude, eta: s.altitude / 2 }
    default:
      return null
  }
}

export function coverage(progress: Record<SectorId, number>) {
  const ids: SectorId[] = ['A', 'B', 'C']
  const total = ids.reduce((sum, id) => sum + SECTORS[id].length, 0)
  const done = ids.reduce((sum, id) => sum + progress[id], 0)
  return done / total
}

export function sectorPct(id: SectorId, progress: Record<SectorId, number>) {
  return progress[id] / SECTORS[id].length
}

export function sectorOwner(id: SectorId, drones: Drone[]) {
  const active = drones.find((d) => d.assignments[0] === id)
  if (active) return { drone: active, queued: false }
  const queued = drones.find((d) => d.assignments.includes(id))
  if (queued) return { drone: queued, queued: true }
  return null
}

export function missionEta(drones: Drone[], progress: Record<SectorId, number>, detection: Detection) {
  let worst = 0
  for (const d of drones) {
    if (!d.assignments.length || d.state.mode === 'landed' || d.state.mode === 'rth') continue
    let remaining = d.assignments.reduce((sum, id) => sum + (SECTORS[id].length - progress[id]), 0)
    const target = surveyTarget(d, progress)
    if (target) remaining += dist(d.state.pos, target)
    let t = remaining / d.surveySpeed
    if ((d.state.mode === 'investigate' || d.state.mode === 'orbit') && detection.status === 'unreviewed') t += 90
    worst = Math.max(worst, t)
  }
  return worst
}

export function isAirborne(d: Drone) {
  return d.state.altitude > 0.5
}

export function activeCommand(commands: Command[], droneId: string) {
  for (let i = commands.length - 1; i >= 0; i--) {
    const c = commands[i]
    if (c.droneId === droneId) return c
  }
  return null
}

export function shortActivity(drone: Drone, progress: Record<SectorId, number>) {
  const s = drone.reported
  switch (s.mode) {
    case 'survey': {
      const sector = drone.assignments[0]
      if (!sector) return 'Holding'
      const target = surveyTarget(drone, progress)
      return target && dist(s.pos, target) > 12 ? `To Sector ${sector}` : `Surveying ${sector}`
    }
    case 'rth':
      return 'Returning'
    case 'landing':
      return 'Landing'
    case 'landed':
      return 'Landed'
    case 'takeoff':
      return 'Taking off'
    case 'investigate':
      return 'Investigating'
    case 'orbit':
      return 'Orbiting'
    case 'hold':
      return 'Holding'
  }
}

export function linkState(health: Health): { label: string; tone: 'ok' | 'caution' | 'critical' } {
  if (health.linkLost) return { label: 'Link lost', tone: 'critical' }
  if (health.stale) return { label: 'Link degraded', tone: 'caution' }
  return { label: 'Link good', tone: 'ok' }
}

export function primarySector(drone: Drone): { id: SectorId; released: boolean } | null {
  if (drone.assignments[0]) return { id: drone.assignments[0], released: false }
  if (drone.released[0]) return { id: drone.released[0], released: true }
  return null
}

export function batteryForTrip(drone: Drone, meters: number, speed: number, extraSeconds = 0) {
  return (meters / speed + extraSeconds) * drone.drainPerSec
}
