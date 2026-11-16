/**
 * Thin data-access layer. Every function is async and returns plain JSON-shaped data, so a real
 * API client can replace this file without touching a screen. Latency is simulated.
 */
import orgsJson from '@/mock/orgs.json'
import rostersJson from '@/mock/rosters.json'
import matchesJson from '@/mock/matches.json'
import profilesJson from '@/mock/parity-profiles.json'
import briefsJson from '@/mock/briefs.json'
import glossaryJson from '@/mock/glossary.json'
import threadsJson from '@/mock/threads.json'
import settingsJson from '@/mock/settings.json'
import type { Brief, GlossaryEntry, Match, MetricId, Org, ParityMetric, ParityProfile, ParityReport, ParityState } from '@/lib/types'
import { FAMILIES } from '@/lib/types'

const ORGS = orgsJson as unknown as Org[]
const MATCHES = matchesJson as unknown as Match[]
const PROFILES = profilesJson as unknown as ParityProfile[]
export const getOrgsSync = () => ORGS
export const getMatchesSync = () => MATCHES
export const GLOSSARY = glossaryJson as unknown as GlossaryEntry[]

export const delay = (ms = 220) => new Promise<void>((r) => setTimeout(r, Math.round(ms * (0.6 + Math.random() * 0.7))))

export async function listOrgs(): Promise<Org[]> {
  await delay(80)
  return ORGS
}

export async function listMatches(orgId: string): Promise<Match[]> {
  await delay(260)
  const org = ORGS.find((o) => o.id === orgId)
  if (!org || org.empty) return []
  return MATCHES
}

export async function getMatch(id: string): Promise<Match | null> {
  await delay(140)
  return MATCHES.find((m) => m.id === id) ?? null
}
export const getMatchSync = (id: string) => MATCHES.find((m) => m.id === id) ?? null

function fill(text: string, m: Match): string {
  const n = (v: number | null) => (v === null ? 'n/a' : String(v))
  return text.replace('{hz}', n(m.ingest.hz)).replace('{occ}', n(m.ingest.occludedPct)).replace('{drop}', n(m.ingest.droppedPct))
}

export function parityFor(m: Match): ParityReport {
  const profile = PROFILES.find((p) => p.id === m.parityProfile)!
  const metrics = {} as Record<MetricId, ParityMetric>
  const summary = { full: 0, degraded: 0, blocked: 0 }
  for (const [id, pm] of Object.entries(profile.metrics) as [MetricId, ParityMetric][]) {
    metrics[id] = { ...pm, reason: fill(pm.reason, m) }
    summary[pm.state]++
  }
  // The measured figure shown beside the reason, where one exists.
  if (m.ingest.hz && m.ingest.occludedPct !== null) {
    metrics.pressure_index.measure = `${m.ingest.hz} Hz, ${m.ingest.occludedPct}% occluded`
    metrics.pressure_received.measure = `${m.ingest.hz} Hz, ${m.ingest.occludedPct}% occluded`
  }
  if (m.ingest.hz && m.ingest.droppedPct !== null) {
    metrics.distance_speed.measure = `${m.ingest.hz} Hz, ${m.ingest.droppedPct}% dropped`
  }
  return { matchId: m.id, metrics, summary, coverage: m.coverage ?? null, engineVersion: 'engine 0.8.2 (sample)', generatedAt: new Date(new Date(m.date).getTime() + 95 * 60000 + 14 * 60000).toISOString() }
}

/** The club's roster for one team, as the client holds it (names never leave the client). Null when there is none. */
export function getRosterSync(team: string): Record<number, string> | null {
  const r = (rostersJson as Record<string, Record<string, string> | string>)[team]
  return r && typeof r === 'object' ? (Object.fromEntries(Object.entries(r).map(([k, v]) => [Number(k), v])) as Record<number, string>) : null
}

export function paritySummarySync(m: Match) {
  return parityFor(m).summary
}

export async function getParityReport(matchId: string): Promise<ParityReport | null> {
  await delay(200)
  const m = getMatchSync(matchId)
  return m ? parityFor(m) : null
}

export function familyState(report: ParityReport, family: (typeof FAMILIES)[number]): ParityState {
  const [a, b] = family.metrics.map((id) => report.metrics[id].state)
  if (a === b) return a
  if (a === 'blocked' && b === 'blocked') return 'blocked'
  return 'degraded'
}

export async function getBrief(matchId: string): Promise<Brief | null> {
  await delay(240)
  const m = getMatchSync(matchId)
  if (!m || !m.pack || m.briefStatus !== 'ready') return null
  const raw = (briefsJson as unknown as Record<string, Omit<Brief, 'matchId' | 'generatedAt'> & { generatedOffsetMin: number }>)[m.pack]
  return {
    matchId,
    model: raw.model,
    generatedAt: new Date(new Date(m.date).getTime() + raw.generatedOffsetMin * 60000).toISOString(),
    themes: raw.themes,
    limitations: raw.limitations,
  }
}

export async function listThreads() {
  await delay(120)
  return threadsJson as { id: string; title: string; matchId: string; updatedAt: string; questions: string[] }[]
}

export async function getSettings() {
  await delay(160)
  return settingsJson
}

export const glossaryEntry = (id: string) => GLOSSARY.find((g) => g.id === id)
