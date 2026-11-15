/* Domain model. Shaped like the API a real backend would return. */

export type Provider = 'metrica' | 'skillcorner' | 'statsbomb' | 'statsports'
export type SourceKind = 'optical' | 'gps' | 'events'
export type Tier = 1 | 2 | 3
export type ParityState = 'full' | 'degraded' | 'blocked'
export type Pack = 'optical' | 'events' | 'gps'
export type Team = 'h' | 'a'
export type Band = 'poor' | 'suboptimal' | 'good' | 'optimal'
export type EventType = 'pass' | 'carry' | 'shot' | 'defensive' | 'run' | 'effort'
export type Outcome = 'complete' | 'lost' | 'goal' | 'saved' | 'off_target' | 'blocked' | 'won' | 'n/a'
export type V2 = [number, number]

export type MetricId =
  | 'pressure_index' | 'pressure_received'
  | 'control_surface' | 'control_share'
  | 'pass_value' | 'pass_alternatives'
  | 'carry_value' | 'carry_alternatives'
  | 'run_value' | 'space_created'
  | 'distance_speed' | 'high_intensity'
  | 'load_trend' | 'fitness_linked'

export type FamilyId = 'pressure' | 'control' | 'pass_dq' | 'carry_dq' | 'offball' | 'load' | 'fatigue'

export const FAMILIES: { id: FamilyId; metrics: [MetricId, MetricId] }[] = [
  { id: 'pressure', metrics: ['pressure_index', 'pressure_received'] },
  { id: 'control', metrics: ['control_surface', 'control_share'] },
  { id: 'pass_dq', metrics: ['pass_value', 'pass_alternatives'] },
  { id: 'carry_dq', metrics: ['carry_value', 'carry_alternatives'] },
  { id: 'offball', metrics: ['run_value', 'space_created'] },
  { id: 'load', metrics: ['distance_speed', 'high_intensity'] },
  { id: 'fatigue', metrics: ['load_trend', 'fitness_linked'] },
]

export type MatchStatus = 'queued' | 'processing' | 'ready' | 'needs_attention' | 'failed'
export type BriefStatus = 'ready' | 'generating' | 'not_generated' | 'locked'
export type TierStatus = 'live' | 'in_development'

export interface SourceRef {
  provider: Provider
  kind: SourceKind
  label: string // e.g. "Tracking export, 25 Hz"
}

export interface Match {
  id: string
  home: string
  away: string
  squad: 'first' | 'u21' | 'u18'
  competition: string
  date: string // ISO
  score: [number, number] | null
  sources: SourceRef[]
  tier: Tier
  tierStatus: TierStatus
  parityProfile: string
  status: MatchStatus
  stage?: number // 0..4 index of PROCESSING_STAGES
  stageProgress?: number // 0..1 inside the stage
  issue?: string // plain-language cause for failed / needs attention
  briefStatus: BriefStatus
  lastOpened: string | null
  pack: Pack | null
  confDelta?: number
  ingest: { hz: number | null; occludedPct: number | null; droppedPct: number | null; durationMin: number; players: number; format: string }
  fixtureNote?: string
}

export const PROCESSING_STAGES = ['parsing', 'normalising', 'quality_check', 'analysing', 'writing_brief'] as const

export interface ParityMetric {
  state: ParityState
  reason: string
  measure?: string
  unlock: string
  inDevelopment?: boolean
}
export interface ParityProfile {
  id: string
  label: string
  metrics: Record<MetricId, ParityMetric>
}
export interface ParityReport {
  matchId: string
  metrics: Record<MetricId, ParityMetric>
  summary: { full: number; degraded: number; blocked: number }
  engineVersion: string
  generatedAt: string
}

export interface Alt {
  to: V2
  v: number // value of the destination
  p: number // likelihood the action succeeds
  s: number // v x p, the score used for ranking
  label: string
  rank: number
  num?: number
  chosen?: boolean
}

export interface MatchEvent {
  id: string
  t: number // seconds from kick-off clock
  dur: number
  type: EventType
  team: Team
  num: number
  toNum?: number
  from: V2
  to: V2
  outcome: Outcome
  press: number
  conf: number
  confNote?: string
  period: 1 | 2
  // Decision quality (pass / carry): working
  vA?: number
  vB?: number
  dq?: number
  band?: Band
  alts?: Alt[]
  // Event-only estimate (no alternatives available)
  est?: { lo: Band; hi: Band }
  // Off-ball movement value
  ovm?: number
  ovmFrom?: number
  ovmTo?: number
  // Physical effort (GPS)
  effort?: { kind: 'sprint' | 'high_speed' | 'acceleration'; peak: number; dist: number }
  key?: boolean
  hidden?: boolean
  restart?: boolean
  note?: string
}

export interface PackData {
  pack: Pack
  htAt: number
  duration: number
  teams: { showHome: boolean; showAway: boolean; showBall: boolean; players: boolean }
  events: MatchEvent[]
}

export interface Citation {
  event: string
}
export interface BriefBullet {
  id: string
  text: string
  citations: string[]
}
export interface BriefTheme {
  id: 'build_up' | 'pressure' | 'transitions' | 'decisions' | 'load' | 'efforts'
  title: string
  bullets: BriefBullet[]
}
export interface Brief {
  matchId: string
  model: string
  generatedAt: string
  themes: BriefTheme[]
  limitations: string[]
}

export interface GlossaryEntry {
  id: string
  term: string
  short: string // inline form, e.g. "pressure index >= 0.7"
  definition: string
}

export interface Org {
  id: string
  name: string
  kind: string
  empty?: boolean
  squads: { id: 'all' | 'first' | 'u21' | 'u18'; name: string }[]
}

export interface PlayerInfo {
  team: Team
  num: number
  label: string // "Home 7"
  role: string
}
