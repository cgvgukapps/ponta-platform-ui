/**
 * Shape of the shareable match page payload, written by ponta-platform's
 * `tools/match_page_payload.py`. Field names follow the semantic event schema
 * (ponta-blueprint/ai-layer.md). Documented in docs/match-page-payload.md.
 */
export type State = 'full' | 'degraded' | 'blocked'
export type BandName = 'low_gain' | 'partial_gain' | 'most_gain' | 'full_gain' | 'not_scored'

export interface MetricCheck {
  family: string
  label: string
  state: State
  reason: string
  measure: string | null
  unlock: string | null
}

export interface Snapshot {
  frame: number
  players: { ref: string; team: 'home' | 'away'; x: number; y: number }[]
  ball: { x: number; y: number } | null
  start: { x: number; y: number } | null
  end: { x: number; y: number } | null
}

export interface Moment {
  event_id: string
  event_idx: number
  timestamp_s: number
  minute_display: string
  period: number | null
  actor_player_ref: string | null
  actor_team: 'home' | 'away'
  action_type: 'pass' | 'carry' | 'off_ball_run' | 'defensive_action'
  action_outcome: string | null
  target_player_ref: string | null
  inferred_intended_ref: string | null
  inference_confidence: string | null
  dq_score: number | null
  dq_band: BandName | null
  chosen_option_pov: number | null
  best_option_player_ref: string | null
  best_option_pov: number | null
  xt_delta: number | null
  movement_value: number | null
  opposition_pressure: number | null
  pitch_zone: string | null
  ball_detected: boolean | null
  players_observed: number | null
  snapshot: Snapshot | null
}

export interface MatchPagePayload {
  payload_version: string
  schema_version: string
  engine_version: string
  generated_at: string
  sample_data: boolean
  match: { match_id: string; provider: string; home: string; away: string; duration_min: number; sample_rate_hz: number; pitch: { length_m: number; width_m: number } }
  data_check: {
    mode: string
    summary: Record<State, number>
    coverage: Record<string, number | null>
    metrics: Record<string, MetricCheck>
  }
  coverage: {
    decisions_total: number
    decisions_scored: number
    scored_share: number | null
    not_scored_causes: Record<string, number>
    ball_detected_share: number | null
    player_observation_share: number | null
  }
  moment_groups: { id: string; title: string; rule: string; moments: Moment[] }[]
  notes: string[]
  statement: string
}
