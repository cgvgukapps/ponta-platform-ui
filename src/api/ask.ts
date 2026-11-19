/**
 * Mock "AI" for Ask Ponta. It matches a handful of intents and answers by filtering the match's
 * real event list. No number in an answer is computed here: every figure lives on a cited event
 * and is rendered inside a chip or a table row. The point is the shape of the answer
 * (parity statement, summary, playlist, named thresholds, refusal), not the intelligence.
 */
import type { Match, MetricId, ParityState } from '@/lib/types'
import { forwardProgress } from '@/lib/events'
import { HIGH_PRESSURE } from '@/lib/bands'
import { delay, parityFor } from './index'
import { loadPack, type LoadedPack } from './packs'

export interface AskStatement {
  state: ParityState | 'info'
  text: string
}
/**
 * What a question is about, when it was asked from a specific place: the moments a brief point
 * cites, or the moment selected in the replay. The answer is grounded in exactly those events.
 */
export interface AskContext {
  events: string[]
  /** Short label shown on the context chip, for example "Pass at 34:12". */
  label: string
}

export interface AskAnswer {
  id: string
  question: string
  matchId: string
  kind: 'answer' | 'refusal' | 'empty'
  statements: AskStatement[]
  summary: string
  thresholds: string[]
  playlist: string[]
  refusal?: { title: string; reasons: string[]; blocked: MetricId[]; alternatives: { label: string; prompt: string }[] }
  followUps: string[]
}

const METRIC_LABEL: Record<MetricId, string> = {
  pressure_index: 'Opposition pressure', pressure_received: 'Pressure received', control_surface: 'Control zones', control_share: 'Control share',
  pass_value: 'Pass decision quality', pass_alternatives: 'Pass alternatives', carry_value: 'Carry decision quality', carry_alternatives: 'Carry alternatives',
  run_value: 'Off-ball movement value', space_created: 'Space created', distance_speed: 'Distance and speed', high_intensity: 'High-intensity efforts',
  load_trend: 'Load trend', fitness_linked: 'Fitness-linked decisions',
}

type IntentId = 'fatigue' | 'loss_pressure' | 'counters' | 'progressive' | 'runs' | 'efforts' | 'loss' | 'unknown'

const INTENTS: { id: IntentId; test: RegExp }[] = [
  { id: 'fatigue', test: /fatigu|injur|tired|exhaust|readiness|overload|risk/i },
  { id: 'loss_pressure', test: /(los[et]|loss|turnover|gave away|give away).*pressur|pressur.*(los[et]|loss|turnover)/i },
  { id: 'counters', test: /counter|transition|conceded|break against/i },
  { id: 'progressive', test: /progressive|through|between the lines|optimal|full gain|best pass|broke/i },
  { id: 'runs', test: /\bruns?\b|off-ball|movement|channel/i },
  { id: 'efforts', test: /sprint|high-speed|effort|speed|load/i },
  { id: 'loss', test: /los[et]|loss|turnover|possession/i },
]

function timeWindow(q: string, htAt: number): [number, number, string] {
  const min = q.match(/(\d+)(?:st|nd|rd|th)\s+minute/i)
  if (/second half|2nd half|second period/i.test(q)) return [htAt, Infinity, 'second half']
  if (/first half|1st half|first period/i.test(q)) return [0, htAt, 'first half']
  if (min && /after/i.test(q)) return [Number(min[1]) * 60, Infinity, `after minute ${min[1]}`]
  if (/last (\d+) minutes/i.test(q)) return [(95 - Number(q.match(/last (\d+) minutes/i)![1])) * 60, Infinity, 'late in the match']
  return [0, Infinity, 'whole match']
}

let counter = 100

export async function askPonta(matchId: string, question: string, context?: AskContext): Promise<AskAnswer> {
  await delay(500)
  const id = `ans_${counter++}`
  const base = { id, question, matchId, statements: [] as AskStatement[], thresholds: [] as string[], playlist: [] as string[], followUps: [] as string[] }
  let lp: LoadedPack
  try {
    lp = await loadPack(matchId)
  } catch {
    return { ...base, kind: 'refusal', summary: '', refusal: { title: 'This match has no analysed data yet', reasons: ['Ask Ponta works on matches that have finished processing. Pick a match with a ready brief.'], blocked: [], alternatives: [] } }
  }
  const match = lp.match
  const report = parityFor(match)
  const intent = INTENTS.find((i) => i.test.test(question))?.id ?? 'unknown'
  const [t0, t1, windowName] = timeWindow(question, lp.data.htAt)
  const inWin = (t: number) => t >= t0 && t < t1
  const gpsConnected = match.sources.some((s) => s.kind === 'gps')

  const stateOf = (m: MetricId) => report.metrics[m].state
  const requireMetrics = (ms: MetricId[]) => ({
    blocked: ms.filter((m) => stateOf(m) === 'blocked'),
    degraded: ms.filter((m) => stateOf(m) === 'degraded'),
  })
  const degradedStatements = (ms: MetricId[]): AskStatement[] =>
    ms.filter((m) => stateOf(m) === 'degraded').map((m) => ({ state: 'degraded', text: `${METRIC_LABEL[m]} is Degraded for this match. ${report.metrics[m].reason}` }))

  const refuse = (title: string, reasons: string[], blocked: MetricId[], alternatives: { label: string; prompt: string }[]): AskAnswer => ({
    ...base,
    kind: 'refusal',
    summary: '',
    refusal: { title, reasons, blocked, alternatives },
    followUps: [],
  })

  const altsFor = (m: Match) => {
    const list: { label: string; prompt: string }[] = []
    if (m.pack === 'optical') {
      list.push({ label: 'Show high-value off-ball runs after the 70th minute', prompt: 'Show high-value off-ball runs after the 70th minute' })
      list.push({ label: 'Show ball losses in the last 20 minutes', prompt: 'Show ball losses in the last 20 minutes' })
    } else if (m.pack === 'events') {
      list.push({ label: 'Show ball losses in the second half', prompt: 'Show ball losses in the second half' })
      list.push({ label: 'Show the progressive passes in this match', prompt: 'Show the progressive passes in this match' })
    } else {
      list.push({ label: 'Show sprint efforts in the second period', prompt: 'Show sprint efforts in the second half' })
    }
    return list
  }

  // Asked about specific moments (a brief point, a selected moment). Medical and fatigue questions
  // are still refused below, whatever the context.
  if (context?.events.length && intent !== 'fatigue') {
    const picked = context.events.map((id) => lp.byId.get(id)).filter((e): e is NonNullable<typeof e> => !!e).sort((a, b) => a.t - b.t)
    if (!picked.length) return refuse('Those moments are not in this match', ['The moments this question refers to could not be found in the event record for this match.'], [], altsFor(match))
    const tok = (team: 'h' | 'a', num: number) => `{${team === 'h' ? 'home' : 'away'}_${num}}`
    if (picked.length === 1) {
      const e = picked[0]
      // The same team's passes and carries in the 20 seconds before it: the lead-up, from the event record.
      const lead = lp.events.filter((x) => x.team === e.team && x.t < e.t && x.t >= e.t - 20 && (x.type === 'pass' || x.type === 'carry')).slice(-3)
      const mm = String(Math.floor(e.t / 60)).padStart(2, '0')
      const ss = String(Math.floor(e.t % 60)).padStart(2, '0')
      return {
        ...base,
        kind: 'answer',
        statements: degradedStatements(['pass_value', 'pass_alternatives']),
        summary: `This is ${tok(e.team, e.num)}'s ${e.type === 'run' ? 'off-ball run' : e.type} at ${mm}:${ss}${lead.length ? ', after the passes and carries by the same team in the 20 seconds before it' : ''}. Open the last moment to see the options at the time and how its rating was worked out.`,
        thresholds: e.band ? ['decision_quality', 'ring'] : ['low_confidence'],
        playlist: [...lead.map((x) => x.id), e.id],
        followUps: altsFor(match).slice(0, 1).map((a) => a.prompt),
      }
    }
    return {
      ...base,
      kind: 'answer',
      statements: degradedStatements(['pass_value', 'pass_alternatives']),
      summary: 'These are the moments this point of the brief cites, in match order. Open each one to see the options at the time and how its rating was worked out.',
      thresholds: ['decision_quality'],
      playlist: picked.map((e) => e.id),
      followUps: altsFor(match).slice(0, 1).map((a) => a.prompt),
    }
  }

  if (intent === 'fatigue') {
    const reasons = [
      'Ponta does not infer fatigue, readiness or injury risk. The product makes no medical claims and gives no injury prediction.',
      report.metrics.fitness_linked.reason + ' ' + report.metrics.fitness_linked.unlock,
    ]
    reasons.push(
      match.pack === 'gps'
        ? 'Wearable load in this session is descriptive: it shows what players did, not how tired they were.'
        : 'Distance and speed from tracking describe movement. They are not a measure of fatigue.',
    )
    return refuse('This question cannot be answered from this match', reasons, ['fitness_linked'], altsFor(match))
  }

  if (intent === 'loss_pressure') {
    const need: MetricId[] = ['pressure_index']
    const { blocked, degraded } = requireMetrics(need)
    if (blocked.length) {
      return refuse(
        'Opposition pressure is Blocked for this match',
        [report.metrics.pressure_index.reason, 'Ponta will not estimate pressure from event locations alone.', report.metrics.pressure_index.unlock],
        blocked,
        [{ label: 'Show ball losses in the second half (no pressure filter)', prompt: 'Show ball losses in the second half' }],
      )
    }
    const list = lp.events.filter((e) => e.team === 'h' && (e.type === 'pass' || e.type === 'carry') && e.outcome === 'lost' && e.press >= HIGH_PRESSURE && inWin(e.t)).slice(0, 6)
    const statements = degradedStatements(need)
    if (!gpsConnected) statements.push({ state: 'info', text: "Wearable data isn't connected for this match, so this uses optical pressure only." })
    if (!list.length) return { ...base, kind: 'empty', statements, summary: 'No ball losses in this window met the high-pressure threshold.', thresholds: ['high_pressure', 'ball_loss'], followUps: [] }
    return {
      ...base,
      kind: 'answer',
      statements,
      summary: `These are Home's ball losses in the ${windowName} where the nearest opponent was within the high-pressure threshold. The playlist is in match order. Open a moment to see the pressure working and the options Home had.`,
      thresholds: ['high_pressure', 'ball_loss', 'low_confidence'],
      playlist: list.map((e) => e.id),
      followUps: ['Show the counter-attacks we conceded after losing the ball', 'Which of these had Low gain?'],
    }
  }

  if (intent === 'loss') {
    const list = lp.events.filter((e) => e.team === 'h' && (e.type === 'pass' || e.type === 'carry') && e.outcome === 'lost' && inWin(e.t))
    // spread across the window: take every k-th so the playlist is not one passage of play
    const step = Math.max(1, Math.floor(list.length / 6))
    const picked = list.filter((_, i) => i % step === 0).slice(0, 6)
    const statements: AskStatement[] = lp.eventOnly ? [{ state: 'degraded', text: 'This match has event data only. Ball losses are listed from the feed, without pressure or player positions.' }] : []
    return {
      ...base,
      kind: picked.length ? 'answer' : 'empty',
      statements,
      summary: picked.length ? `This is a sample of Home's ball losses in the ${windowName}, in match order, taken from the event record.` : 'No ball losses were found in this window.',
      thresholds: ['ball_loss', 'low_confidence'],
      playlist: picked.map((e) => e.id),
      followUps: [],
    }
  }

  if (intent === 'progressive') {
    const need: MetricId[] = ['pass_value']
    const { blocked } = requireMetrics(need)
    if (blocked.length) return refuse('Pass decision quality is Blocked for this match', [report.metrics.pass_value.reason, report.metrics.pass_value.unlock], blocked, altsFor(match))
    const list = lp.events
      .filter((e) => e.team === 'h' && e.type === 'pass' && e.outcome === 'complete' && forwardProgress(e) >= 15 && inWin(e.t))
      .filter((e) => (e.band ? e.band === 'full_gain' : e.est?.hi === 'full_gain'))
      .slice(0, 12)
    const step = Math.max(1, Math.floor(list.length / 6))
    const picked = list.filter((_, i) => i % step === 0).slice(0, 6)
    const statements = degradedStatements(need)
    if (lp.eventOnly) statements.unshift({ state: 'degraded', text: 'Decision quality in this match is an event-only estimate, shown as a range. Passes below could sit in a lower band.' })
    return {
      ...base,
      kind: picked.length ? 'answer' : 'empty',
      statements,
      summary: picked.length ? 'These completed passes moved the ball well forward and were rated in the top band. They are listed in match order.' : 'No passes in this window met both conditions.',
      thresholds: ['progressive_pass', 'decision_quality', 'ring'],
      playlist: picked.map((e) => e.id),
      followUps: ['Where did we lose the ball under high pressure in the second half?'],
    }
  }

  if (intent === 'counters') {
    const need: MetricId[] = ['pass_value']
    const { blocked } = requireMetrics(need)
    if (blocked.length) return refuse('Transitions need ball and event data that this match does not have', [report.metrics.pass_value.reason, report.metrics.pass_value.unlock], blocked, altsFor(match))
    const out: string[] = []
    const losses = lp.events.filter((e) => e.team === 'h' && e.outcome === 'lost' && (e.type === 'pass' || e.type === 'carry') && inWin(e.t))
    for (const l of losses) {
      const c = lp.events.find((e) => e.team === 'a' && e.type === 'carry' && e.t > l.t && e.t - l.t < 10 && forwardProgress(e) >= 20)
      if (c && !out.includes(c.id)) out.push(c.id)
    }
    const statements: AskStatement[] = lp.eventOnly ? [{ state: 'degraded', text: 'Event-only match: carries are listed from the feed. Home\u2019s shape at the moment of each turnover cannot be shown.' }] : []
    return {
      ...base,
      kind: out.length ? 'answer' : 'empty',
      statements,
      summary: out.length ? 'These are carries by Away that began soon after a Home turnover and moved well towards goal. Each opens at the carry. The turnover is the moment just before.' : 'No transition carries matched in this window.',
      thresholds: ['counter', 'ball_loss'],
      playlist: out.slice(0, 6),
      followUps: ['Where did we lose the ball under high pressure in the second half?'],
    }
  }

  if (intent === 'runs') {
    const need: MetricId[] = ['run_value']
    const { blocked } = requireMetrics(need)
    if (blocked.length) return refuse('Off-ball movement is Blocked for this match', [report.metrics.run_value.reason, report.metrics.run_value.unlock], blocked, altsFor(match))
    const list = lp.events.filter((e) => e.type === 'run' && e.team === 'h' && (e.ovm ?? 0) >= 0.25 && inWin(e.t)).slice(0, 6)
    return {
      ...base,
      kind: list.length ? 'answer' : 'empty',
      statements: degradedStatements(need),
      summary: list.length ? `These are Home's off-ball runs in the ${windowName} with the highest movement value. Open one to see where the runner started and finished.` : 'No off-ball runs in this window reached that movement value.',
      thresholds: ['value_surface', 'low_confidence'],
      playlist: list.map((e) => e.id),
      followUps: [],
    }
  }

  if (intent === 'efforts') {
    const list = lp.events.filter((e) => e.type === 'effort' && e.effort?.kind === 'sprint' && inWin(e.t)).slice(0, 6)
    if (!list.length) {
      return refuse('This match has no wearable effort data', ['Sprint efforts come from a wearable export. Only optical distance and speed are available for this match.', report.metrics.high_intensity.unlock], ['high_intensity'], altsFor(match))
    }
    return {
      ...base,
      kind: 'answer',
      statements: [{ state: 'info', text: 'Physical context is shown as description and association only. It is not a measure of fatigue or readiness.' }],
      summary: `These are sprint efforts in the ${windowName}, in session order. Peak speeds are shown on each effort and carry measurement error.`,
      thresholds: ['low_confidence'],
      playlist: list.map((e) => e.id),
      followUps: [],
    }
  }

  return {
    ...base,
    kind: 'refusal',
    summary: '',
    refusal: {
      title: 'Ponta cannot answer that from this match yet',
      reasons: ['Ask Ponta answers questions that can be grounded in cited moments from the match: ball losses, progressive passes, transitions, off-ball runs and physical efforts.', 'It does not give opinions on players or predict outcomes.'],
      blocked: [],
      alternatives: altsFor(match),
    },
  }
}
