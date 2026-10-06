import { lawnmower, pathLength, pointAlong, type XY } from './geo'
import type { Detection, Drone, DroneState, MissionEvent, Sector, SectorId } from './types'

export const MISSION_NAME = 'Western Ridge Patrol'
export const MISSION_START_CLOCK = 14 * 3600 + 2 * 60
export const SCENARIO_ID = 'WR-03'
export const INITIAL_ELAPSED = 15 * 60 + 1
export const RESERVE_PCT = 20
export const CRITICAL_PCT = 10
export const STALE_AFTER = 3
export const LINK_LOST_AFTER = 15
export const FAILSAFE_AFTER = 30
export const LANE_SPACING = 170

export const HOME: XY = { x: -150, y: -1180 }
export const HOME_NAME = 'LZ-1 Ridge Road'

export const BOUNDARY: XY[] = [
  { x: -1200, y: -700 },
  { x: -300, y: -900 },
  { x: 900, y: -800 },
  { x: 1300, y: -200 },
  { x: 1150, y: 650 },
  { x: 200, y: 900 },
  { x: -900, y: 750 },
  { x: -1350, y: 100 },
]

const SECTOR_POLYS: Record<SectorId, XY[]> = {
  A: [
    { x: -1200, y: -700 },
    { x: -400, y: -878 },
    { x: -400, y: 818 },
    { x: -900, y: 750 },
    { x: -1350, y: 100 },
  ],
  B: [
    { x: -400, y: -878 },
    { x: -300, y: -900 },
    { x: 450, y: -837 },
    { x: 450, y: 834 },
    { x: 200, y: 900 },
    { x: -400, y: 818 },
  ],
  C: [
    { x: 450, y: -837 },
    { x: 900, y: -800 },
    { x: 1300, y: -200 },
    { x: 1150, y: 650 },
    { x: 450, y: 834 },
  ],
}

function buildSector(id: SectorId): Sector {
  const polygon = SECTOR_POLYS[id]
  const path = lawnmower(polygon, LANE_SPACING, 45)
  return { id, polygon, path, length: pathLength(path) }
}

export const SECTORS: Record<SectorId, Sector> = {
  A: buildSector('A'),
  B: buildSector('B'),
  C: buildSector('C'),
}

export const INITIAL_PROGRESS: Record<SectorId, number> = {
  A: SECTORS.A.length * 0.5,
  B: SECTORS.B.length * 0.22,
  C: SECTORS.C.length * 0.72,
}

export const DETECTION_POS: XY = { x: 950, y: 300 }

function state(partial: Omit<DroneState, 'heading'> & { heading?: number }): DroneState {
  return { heading: 0, ...partial }
}

function baseDrone(d: Omit<Drone, 'reported' | 'reportedAt' | 'trail' | 'lastTrailAt' | 'linkDown' | 'linkDownAt' | 'failsafeTriggered' | 'reserveOverride' | 'surveyLock' | 'orbitAngle'>): Drone {
  return {
    ...d,
    reported: { ...d.state },
    reportedAt: INITIAL_ELAPSED,
    trail: [],
    lastTrailAt: INITIAL_ELAPSED,
    linkDown: false,
    linkDownAt: null,
    failsafeTriggered: false,
    reserveOverride: false,
    surveyLock: false,
    orbitAngle: 0,
  }
}

const d1Start = pointAlong(SECTORS.A.path, INITIAL_PROGRESS.A)
const D3_ORBIT_ANGLE = -2.4
const D3_ORBIT_POS: XY = {
  x: DETECTION_POS.x + Math.sin(D3_ORBIT_ANGLE) * 45,
  y: DETECTION_POS.y + Math.cos(D3_ORBIT_ANGLE) * 45,
}

export const INITIAL_DRONES: Drone[] = [
  baseDrone({
    id: 'd1',
    name: 'Drone 1',
    short: 'D1',
    airframe: 'M30T · S/N 4H71',
    surveySpeed: 16,
    drainPerSec: 0.03,
    assignments: ['A', 'B'],
    released: [],
    state: state({ pos: d1Start.p, heading: d1Start.heading, altitude: 40, groundspeed: 16, battery: 82, mode: 'survey' }),
    reason: {
      trigger: 'Sector B coverage was released when Drone 2 reached its battery reserve at 14:15:51.',
      rule: 'Unfinished coverage is reassigned to the airborne drone with the most battery margin.',
      effect: 'Sector A continues. Sector B is queued behind it.',
      next: 'After Sector A, Drone 1 will fly the remaining 78% of Sector B.',
      override: 'Hold position or return home at any time.',
    },
  }),
  baseDrone({
    id: 'd2',
    name: 'Drone 2',
    short: 'D2',
    airframe: 'M30T · S/N 4H88',
    surveySpeed: 16,
    drainPerSec: 0.04,
    assignments: [],
    released: ['B'],
    state: state({ pos: { x: 150, y: 70 }, heading: 193, altitude: 55, groundspeed: 8, battery: 18.4, mode: 'rth' }),
    reason: {
      trigger: 'Battery crossed the configured 20% reserve threshold.',
      rule: 'A drone at reserve stops surveying and returns to LZ-1 with enough charge to land.',
      effect: 'Sector B has paused at 22% coverage.',
      next: 'Drone 1 will finish the remaining portion of Sector B after completing Sector A.',
      override: 'Cancel return suppresses the reserve rule until landing. Land now descends in place.',
    },
  }),
  baseDrone({
    id: 'd3',
    name: 'Drone 3',
    short: 'D3',
    airframe: 'M30T · S/N 4J02',
    surveySpeed: 16,
    drainPerSec: 0.032,
    assignments: ['C'],
    released: [],
    state: state({ pos: D3_ORBIT_POS, heading: 312, altitude: 60, groundspeed: 6, battery: 72.6, mode: 'orbit' }),
    reason: {
      trigger: 'Thermal model flagged a 91% hotspot in Sector C at 14:16:23.',
      rule: 'Detections at or above 85% confidence are investigated by the nearest drone with margin.',
      effect: 'Sector C has paused at 72% coverage.',
      next: 'Holding a 45 m orbit at 60 m and streaming thermal imagery until the operator confirms or dismisses.',
      override: 'Dismiss the detection to resume Sector C immediately.',
    },
  }),
].map((d) => (d.id === 'd3' ? { ...d, orbitAngle: D3_ORBIT_ANGLE } : d))

export const INITIAL_DETECTION: Detection = {
  id: 'DET-0412',
  pos: DETECTION_POS,
  confidence: 0.91,
  detectedAt: INITIAL_ELAPSED - 38,
  detectedBy: 'd3',
  uncertainty: 6,
  peakTemp: 312,
  frame: 'IR-0412',
  status: 'unreviewed',
  investigator: 'd3',
  arrivedAt: INITIAL_ELAPSED - 12,
  resolvedAt: null,
  sectorPausedAt: 0.72,
  responseApproved: true,
}

export const INITIAL_EVENTS: MissionEvent[] = [
  { id: 'e1', t: 0, text: 'Mission started · 3 aircraft launched from LZ-1', severity: 'info', target: { type: 'home' }, kind: 'mission' },
  { id: 'e2', t: 70, text: 'Drone 1 assigned Sector A', severity: 'info', target: { type: 'drone', id: 'd1' }, kind: 'command' },
  { id: 'e3', t: 72, text: 'Drone 2 assigned Sector B', severity: 'info', target: { type: 'drone', id: 'd2' }, kind: 'command' },
  { id: 'e4', t: 74, text: 'Drone 3 assigned Sector C', severity: 'info', target: { type: 'drone', id: 'd3' }, kind: 'command' },
  { id: 'e4b', t: 612, text: 'Drone 2 telemetry delayed 2.1 s · recovered', severity: 'info', target: { type: 'drone', id: 'd2' }, kind: 'telemetry' },
  { id: 'e5', t: 831, text: 'Drone 2 reached 20% battery reserve', severity: 'warning', target: { type: 'drone', id: 'd2' }, kind: 'warning' },
  { id: 'e6', t: 832, text: 'Drone 2 initiated automatic return', severity: 'info', target: { type: 'drone', id: 'd2' }, kind: 'autonomy' },
  { id: 'e7', t: 834, text: 'Remaining Sector B coverage reassigned to Drone 1', severity: 'info', target: { type: 'sector', id: 'B' }, kind: 'autonomy' },
  { id: 'e8', t: 863, text: 'Possible fire detected by Drone 3 · 91% confidence', severity: 'warning', target: { type: 'detection' }, kind: 'detection' },
  { id: 'e9', t: 865, text: 'Drone 3 diverted to investigate · Sector C paused at 72%', severity: 'info', target: { type: 'drone', id: 'd3' }, kind: 'autonomy' },
  { id: 'e10', t: 882, text: 'Operator approved Drone 3 response to DET-0412', severity: 'operator', target: { type: 'detection' }, kind: 'command' },
  { id: 'e11', t: 889, text: 'Drone 3 on scene · orbiting DET-0412 at 60 m', severity: 'info', target: { type: 'drone', id: 'd3' }, kind: 'autonomy' },
  { id: 'e12', t: 890, text: 'Close-range pass refined location to ±6 m', severity: 'info', target: { type: 'detection' }, kind: 'detection' },
]

export function clockAt(elapsed: number, withSeconds = true) {
  const total = Math.floor(MISSION_START_CLOCK + elapsed)
  const h = Math.floor(total / 3600) % 24
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const hm = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return withSeconds ? `${hm}:${String(s).padStart(2, '0')}` : hm
}

export function elapsedLabel(elapsed: number) {
  const t = Math.floor(elapsed)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
