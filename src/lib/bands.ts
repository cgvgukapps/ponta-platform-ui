import type { Band } from './types'

/**
 * Decision-quality bands, as specified for the engine (ANALYTICS_SPECIFICATION.md, section 7.1):
 * unified across passes, carries and intercepted passes. The score is the value of the outcome at
 * arrival divided by the best option at the moment of the decision, clipped to 0 to 1.5, so it can
 * exceed 1.0 when a run made the outcome better than any option available at release.
 */
export const BAND_THRESHOLDS = { suboptimal: 0.55, good: 0.8, optimal: 0.95 } as const
export const DQ_MAX = 1.5
/** At or above this, the outcome beat every option available when the ball was played. */
export const DQ_ELEVATED = 1.0
export const BAND_ORDER: Band[] = ['poor', 'suboptimal', 'good', 'optimal']

export function bandOf(ratio: number): Band {
  if (ratio >= BAND_THRESHOLDS.optimal) return 'optimal'
  if (ratio >= BAND_THRESHOLDS.good) return 'good'
  if (ratio >= BAND_THRESHOLDS.suboptimal) return 'suboptimal'
  return 'poor'
}

export const HIGH_PRESSURE = 0.7
export const LOW_CONFIDENCE = 0.75

export type ConfLevel = 'high' | 'medium' | 'low'
export function confLevel(c: number): ConfLevel {
  if (c >= 0.85) return 'high'
  if (c >= LOW_CONFIDENCE) return 'medium'
  return 'low'
}
