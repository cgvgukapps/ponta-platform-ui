import type { Band } from './types'

/** Prototype thresholds on the decision-quality ratio V(actual) / V(best in ring). */
export const BAND_THRESHOLDS = { suboptimal: 0.4, good: 0.7, optimal: 0.9 } as const
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
