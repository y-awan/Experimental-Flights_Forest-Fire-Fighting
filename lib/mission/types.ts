import type { XY } from './geo'

export type SectorId = 'A' | 'B' | 'C'
export type DroneId = 'd1' | 'd2' | 'd3'

export type DroneMode =
  | 'survey'
  | 'rth'
  | 'landing'
  | 'landed'
  | 'takeoff'
  | 'investigate'
  | 'orbit'
  | 'hold'

export type Sector = {
  id: SectorId
  polygon: XY[]
  path: XY[]
  length: number
}

export type DroneState = {
  pos: XY
  heading: number
  altitude: number
  groundspeed: number
  battery: number
  mode: DroneMode
}

export type Drone = {
  id: DroneId
  name: string
  short: string
  airframe: string
  surveySpeed: number
  drainPerSec: number
  state: DroneState
  reported: DroneState
  reportedAt: number
  linkDown: boolean
  linkDownAt: number | null
  failsafeTriggered: boolean
  assignments: SectorId[]
  released: SectorId[]
  reserveOverride: boolean
  surveyLock: boolean
  orbitAngle: number
  trail: XY[]
  lastTrailAt: number
  reason: AutonomyReason | null
}

export type AutonomyReason = {
  trigger: string
  rule: string
  effect: string
  next?: string
  override?: string
}

export type DetectionStatus = 'unreviewed' | 'confirmed' | 'dismissed'

export type Detection = {
  id: string
  pos: XY
  confidence: number
  detectedAt: number
  detectedBy: DroneId
  uncertainty: number
  peakTemp: number
  frame: string
  status: DetectionStatus
  investigator: DroneId | null
  arrivedAt: number | null
  resolvedAt: number | null
  sectorPausedAt: number
  responseApproved: boolean
}

export type CommandKind =
  | 'rth'
  | 'land'
  | 'cancel-rth'
  | 'takeoff'
  | 'hold'
  | 'resume'
  | 'survey-lock'
  | 'investigate'

export type CommandStage = 'proposed' | 'sent' | 'acknowledged' | 'executing' | 'completed' | 'failed'

export type Command = {
  id: string
  droneId: DroneId
  kind: CommandKind
  label: string
  stage: CommandStage
  stamps: Partial<Record<CommandStage, number>>
  failure?: string
  origin: 'operator' | 'proposal'
}

export type EventTarget =
  | { type: 'drone'; id: DroneId }
  | { type: 'detection' }
  | { type: 'home' }
  | { type: 'sector'; id: SectorId }
  | { type: 'mission' }

export type EventKind = 'command' | 'telemetry' | 'autonomy' | 'warning' | 'detection' | 'mission'

export type MissionEvent = {
  id: string
  t: number
  text: string
  severity: 'info' | 'warning' | 'critical' | 'operator'
  target: EventTarget
  kind?: EventKind
}

export type Selection =
  | { type: 'mission' }
  | { type: 'drone'; id: DroneId }
  | { type: 'sector'; id: SectorId }
  | { type: 'detection' }
  | { type: 'proposal' }
  | { type: 'region' }

export type ProposalChange = {
  droneId: DroneId
  now: string
  proposed: string
  command: CommandKind | null
}

export type SafetyCheck = { label: string; level: 'pass' | 'warn' | 'fail'; detail: string }

export type Proposal = {
  source: string
  understood: boolean
  objective: string
  changes: ProposalChange[]
  routeNotes: string[]
  checks: SafetyCheck[]
  regionArea?: number
}

export type ConfirmRequest =
  | { kind: 'command'; droneId: DroneId; command: CommandKind }
  | { kind: 'confirm-fire' }
  | { kind: 'dismiss-fire' }
  | { kind: 'go-live' }

export type FocusRequest =
  | { nonce: number; kind: 'point'; pos: XY; zoom?: number }
  | { nonce: number; kind: 'bounds'; points: XY[] }
  | { nonce: number; kind: 'fit' }

export type MapLayers = { planned: boolean; completed: boolean; sectors: boolean; trails: boolean }
