import type { Match, MatchEvent, Pack, PackData } from '@/lib/types'
import { Engine } from '@/lib/engine'
import { clamp } from '@/lib/prng'
import { getMatchSync, delay } from './index'

const loaders: Record<Pack, () => Promise<{ default: unknown }>> = {
  optical: () => import('@/mock/packs/optical.json'),
  events: () => import('@/mock/packs/events.json'),
  gps: () => import('@/mock/packs/gps.json'),
}

export interface LoadedPack {
  match: Match
  data: PackData
  /** Every event, including hidden guide events that only drive the motion engine. */
  all: MatchEvent[]
  /** Events a user can see and cite. */
  events: MatchEvent[]
  byId: Map<string, MatchEvent>
  engine: Engine
  eventOnly: boolean
}

const cache = new Map<string, Promise<LoadedPack>>()

/** Loads a match's event pack (lazy chunk), applies per-source confidence, and builds the motion engine. */
export function loadPack(matchId: string): Promise<LoadedPack> {
  let p = cache.get(matchId)
  if (!p) {
    p = (async () => {
      const match = getMatchSync(matchId)
      if (!match || !match.pack) throw new Error('no_pack')
      await delay(220)
      const mod = await loaders[match.pack]()
      const raw = mod.default as PackData
      const delta = match.confDelta ?? 0
      const all = raw.events.map((e) => (delta ? { ...e, conf: Math.round(clamp(e.conf + delta, 0.3, 0.99) * 100) / 100 } : e))
      const events = all.filter((e) => !e.hidden)
      const data: PackData = { ...raw, events: all }
      const engine = new Engine(all, { htAt: raw.htAt, duration: raw.duration, players: raw.teams.players, showHome: raw.teams.showHome, showAway: raw.teams.showAway, showBall: raw.teams.showBall })
      return { match, data, all, events, byId: new Map(events.map((e) => [e.id, e])), engine, eventOnly: raw.pack === 'events' }
    })()
    cache.set(matchId, p)
  }
  return p
}
