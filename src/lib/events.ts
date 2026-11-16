import type { MatchEvent, Team } from './types'
import { t } from '@/i18n'

export const playerLabel = (team: Team, num: number) => `${team === 'h' ? 'Home' : 'Away'} ${num}`

export function eventTypeLabel(e: MatchEvent): string {
  if (e.type === 'pass') return e.outcome === 'lost' ? t('event.pass_lost') : t('event.pass')
  if (e.type === 'carry') return e.outcome === 'lost' ? t('event.carry_lost') : t('event.carry')
  if (e.type === 'effort') return e.effort ? t(`event.effort_${e.effort.kind}`) : t('event.effort')
  return t(`event.${e.type}`)
}

/** Who did it, and to whom. `who` resolves a player to a name or a code (see lib/names). */
export function describeEvent(e: MatchEvent, who: (team: Team, num: number) => string = playerLabel): string {
  const by = who(e.team, e.num)
  if (e.type === 'pass' && e.toNum) return `${by} ${t('event.to')} ${who(e.team, e.toNum)}`
  return by
}

/** Forward progress in the attacking direction of the event's team, in metres. */
export function forwardProgress(e: MatchEvent): number {
  const dir = (e.team === 'h') === (e.period === 1) ? 1 : -1
  return (e.to[0] - e.from[0]) * dir
}

export function periodName(sec: number, htAt: number): string {
  return sec < htAt ? t('period.first') : t('period.second')
}
