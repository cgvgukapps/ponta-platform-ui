import type { Band } from './types'

/**
 * Decision-quality bands, as specified for the engine (ANALYTICS_SPECIFICATION.md, section 7.1):
 * unified across passes, carries and intercepted passes. The score is the value of the outcome at
 * arrival divided by the best option at the moment of the decision, clipped to 0 to 1.5, so it can
 * exceed 1.0 when a run made the outcome better than any option available at release.
 */
export const BAND_THRESHOLDS = { partial_gain: 0.55, most_gain: 0.8, full_gain: 0.95 } as const
export const DQ_MAX = 1.5
/** At or above this, the outcome beat every option available when the ball was played. */
export const DQ_ELEVATED = 1.0
export const BAND_ORDER: Band[] = ['low_gain', 'partial_gain', 'most_gain', 'full_gain']

export function bandOf(ratio: number): Band {
  if (ratio >= BAND_THRESHOLDS.full_gain) return 'full_gain'
  if (ratio >= BAND_THRESHOLDS.most_gain) return 'most_gain'
  if (ratio >= BAND_THRESHOLDS.partial_gain) return 'partial_gain'
  return 'low_gain'
}

export const HIGH_PRESSURE = 0.7
export const LOW_CONFIDENCE = 0.75

export type ConfLevel = 'high' | 'medium' | 'low'
export function confLevel(c: number): ConfLevel {
  if (c >= 0.85) return 'high'
  if (c >= LOW_CONFIDENCE) return 'medium'
  return 'low'
}
