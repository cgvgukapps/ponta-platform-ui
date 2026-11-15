/**
 * Mock trajectory engine.
 *
 * The prototype has no tracking files. Instead, every position is a pure function of match time,
 * built from the event list: a formation that shifts with the (smoothed) ball, a little wander, and
 * "anchors" taken from events so that passers, receivers, carriers, runners and the nearest
 * pressing opponent are exactly where the event says they are at the moment it happens.
 * Stateless, so the scrubber can jump anywhere and playback at 25 Hz stays cheap.
 *
 * Coordinates: metres, absolute pitch frame, 105 x 68, origin at one corner.
 * "Team frame" means x runs from the team's own goal (0) to the goal it attacks (105).
 */
import type { MatchEvent, Team, V2 } from './types'
import { clamp, smoothstep } from './prng'

export const PITCH_L = 105
export const PITCH_W = 68

export function dirFor(team: Team, period: 1 | 2): 1 | -1 {
  const base = team === 'h' ? 1 : -1
  return (period === 1 ? base : -base) as 1 | -1
}
/** Team frame -> absolute (also absolute -> team frame: it is an involution). */
export function toAbs(team: Team, period: 1 | 2, p: V2): V2 {
  return dirFor(team, period) > 0 ? [p[0], p[1]] : [PITCH_L - p[0], PITCH_W - p[1]]
}
export const toFrame = toAbs

/** Value surface for the attacking side, in team frame. Purely illustrative for the prototype. */
export function valueAt(x: number, y: number): number {
  const dx = (PITCH_L - x) / 42
  const lateral = Math.exp(-(((y - 34) / 26) ** 2))
  const box = x > 88 && Math.abs(y - 34) < 20 ? 0.12 : 0
  return 0.04 + 0.6 * Math.exp(-(dx ** 1.5)) * lateral + box
}

export const FORMATION: Record<Team, Record<number, V2>> = {
  h: { 1: [4, 34], 2: [32, 58], 3: [32, 10], 4: [28, 26], 5: [28, 42], 6: [52, 40], 8: [52, 28], 7: [55, 58], 11: [55, 10], 10: [72, 40], 9: [74, 28] },
  a: { 1: [4, 34], 2: [32, 58], 3: [32, 10], 4: [28, 26], 5: [28, 42], 6: [44, 34], 8: [56, 44], 10: [56, 24], 7: [70, 56], 11: [70, 12], 9: [76, 34] },
}
export const NUMS: Record<Team, number[]> = {
  h: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  a: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}
export const SLOTS: { team: Team; num: number }[] = [
  ...NUMS.h.map((num) => ({ team: 'h' as Team, num })),
  ...NUMS.a.map((num) => ({ team: 'a' as Team, num })),
]
export const slotIndex = (team: Team, num: number) => (team === 'h' ? 0 : 11) + NUMS[team].indexOf(num)

export const POSITION_NAME: Record<Team, Record<number, string>> = {
  h: { 1: 'GK', 2: 'RB', 3: 'LB', 4: 'CB', 5: 'CB', 6: 'CM', 7: 'RM', 8: 'CM', 9: 'FW', 10: 'FW', 11: 'LM' },
  a: { 1: 'GK', 2: 'RB', 3: 'LB', 4: 'CB', 5: 'CB', 6: 'DM', 7: 'RW', 8: 'CM', 9: 'CF', 10: 'CM', 11: 'LW' },
}

function lineK(sx: number): number {
  if (sx < 10) return 0.06
  if (sx < 40) return 0.4
  if (sx < 62) return 0.5
  return 0.52
}

/** Where a slot stands for a given ball position, before event anchors are applied. */
export function slotPos(team: Team, num: number, ballAbs: V2, period: 1 | 2, t: number): V2 {
  const b = toFrame(team, period, ballAbs)
  const [sx, sy] = FORMATION[team][num]
  const k = lineK(sx)
  const gk = num === 1 ? 0.25 : 1
  const ph = ((team === 'h' ? 3 : 7) * num * 0.7131) % (Math.PI * 2)
  let x = sx + (b[0] - 52.5) * k
  let y = sy + (b[1] - 34) * (num === 1 ? 0.12 : 0.24)
  x += gk * (3.0 * Math.sin(0.34 * t + ph) + 1.1 * Math.sin(0.93 * t + ph * 1.7))
  y += gk * (2.4 * Math.cos(0.29 * t + ph * 1.3) + 1.0 * Math.sin(0.81 * t + ph * 0.6))
  return toAbs(team, period, [clamp(x, 1.5, PITCH_L - 1.5), clamp(y, 1.5, PITCH_W - 1.5)])
}

export interface PlayerFrame {
  team: Team
  num: number
  x: number
  y: number
  vx: number
  vy: number
  speed: number // m/s
}
export interface BallFrame {
  x: number
  y: number
  team: Team
  inFlight: boolean
  holder: number | null // shirt number of the possessing player, when a player has it
  interpolated: boolean
}
export interface Frame {
  t: number
  period: 1 | 2
  players: PlayerFrame[]
  ball: BallFrame
  confidence: number
}

interface Anchor {
  t: number
  x: number
  y: number
  lin: number
  lout: number
}

export interface EngineOptions {
  htAt: number
  duration: number
  players: boolean
  showHome: boolean
  showAway: boolean
  showBall: boolean
}

const BALL_KINDS = new Set(['pass', 'carry', 'shot'])

export class Engine {
  readonly opts: EngineOptions
  readonly ballEvents: MatchEvent[]
  readonly events: MatchEvent[]
  private anchors: Anchor[][] = SLOTS.map(() => [])
  private dips: { t: number; w: number; d: number }[] = []
  private distCache: Float32Array[] | null = null
  private static readonly DIST_STEP = 0.5

  constructor(events: MatchEvent[], opts: EngineOptions) {
    this.opts = opts
    this.events = events
    this.ballEvents = events.filter((e) => BALL_KINDS.has(e.type)).sort((a, b) => a.t - b.t)
    if (opts.players) this.buildAnchors()
    this.buildDips()
  }

  periodAt(t: number): 1 | 2 {
    return t < this.opts.htAt ? 1 : 2
  }

  private add(team: Team, num: number, t: number, p: V2, lin = 2.8, lout = 2.8) {
    const i = slotIndex(team, num)
    if (i < 0) return
    this.anchors[i].push({ t, x: p[0], y: p[1], lin, lout })
  }

  private buildAnchors() {
    const { events } = this
    const polyline = (e: MatchEvent, step: number, win: number) => {
      const n = Math.max(1, Math.ceil(e.dur / step))
      for (let k = 0; k <= n; k++) {
        const u = k / n
        this.add(e.team, e.num, e.t + u * e.dur, [e.from[0] + (e.to[0] - e.from[0]) * u, e.from[1] + (e.to[1] - e.from[1]) * u], win, win)
      }
    }
    for (const e of events) {
      switch (e.type) {
        case 'pass':
        case 'shot':
          this.add(e.team, e.num, e.t, e.from, 3.2, 2.4)
          if (e.toNum && e.outcome === 'complete') this.add(e.team, e.toNum, e.t + e.dur, e.to, 2.6, 2.6)
          break
        case 'carry':
          polyline(e, 0.5, 0.9)
          break
        case 'defensive':
          this.add(e.team, e.num, e.t, e.from, 2.4, 2.4)
          break
        case 'run':
        case 'effort':
          polyline(e, 0.5, 1.0)
          break
      }
    }
    // Nearest opponent closes down the ball carrier, at a distance set by the event's pressure.
    if (this.opts.showAway && this.opts.showHome) {
      for (const e of this.ballEvents) {
        if (e.press < 0.3 || e.type === 'shot') continue
        const opp: Team = e.team === 'h' ? 'a' : 'h'
        const period = this.periodAt(e.t)
        const ranked = NUMS[opp]
          .map((num) => ({ num, p: slotPos(opp, num, e.from, period, e.t) }))
          .sort((a, b) => Math.hypot(a.p[0] - e.from[0], a.p[1] - e.from[1]) - Math.hypot(b.p[0] - e.from[0], b.p[1] - e.from[1]))
        const dist = 1 + 8 * (1 - e.press)
        const count = e.press > 0.62 ? 2 : 1
        for (let r = 0; r < count; r++) {
          const c = ranked[r]
          if (Math.hypot(c.p[0] - e.from[0], c.p[1] - e.from[1]) > 24) continue
          const vx = c.p[0] - e.from[0]
          const vy = c.p[1] - e.from[1]
          const len = Math.hypot(vx, vy) || 1
          const d = dist + r * 2.4
          this.add(opp, c.num, e.t, [e.from[0] + (vx / len) * d, e.from[1] + (vy / len) * d], 2.2, 1.8)
        }
      }
    }
    for (const list of this.anchors) list.sort((a, b) => a.t - b.t)
  }

  private buildDips() {
    // Confidence dips: low-confidence events plus a few deterministic "occlusion" episodes.
    for (const e of this.events) {
      if (e.conf < 0.8) this.dips.push({ t: e.t + e.dur / 2, w: 3.2, d: 0.94 - e.conf })
    }
    let s = 7
    for (let i = 0; i < 26; i++) {
      s = (s * 9301 + 49297) % 233280
      const t = (s / 233280) * this.opts.duration
      s = (s * 9301 + 49297) % 233280
      this.dips.push({ t, w: 3 + (s / 233280) * 5, d: 0.08 + (s / 233280) * 0.22 })
    }
  }

  /** Per-frame tracking confidence (0..1). */
  confidenceAt(t: number): number {
    let c = 0.95
    for (const d of this.dips) {
      const z = (t - d.t) / d.w
      if (z > -3 && z < 3) c -= d.d * Math.exp(-z * z)
    }
    return clamp(c, 0.2, 0.99)
  }

  private lastBallIndex(t: number): number {
    const arr = this.ballEvents
    let lo = 0
    let hi = arr.length - 1
    let ans = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (arr[mid].t <= t) {
        ans = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return ans
  }

  /** Raw ball state at time t. */
  ballAt(t: number): BallFrame {
    const arr = this.ballEvents
    const i = this.lastBallIndex(t)
    if (i < 0) {
      const n = arr[0]
      const ready = n && t > n.t - 1.2
      return { x: ready ? n.from[0] : 52.5, y: ready ? n.from[1] : 34, team: n?.team ?? 'h', inFlight: false, holder: n?.num ?? null, interpolated: false }
    }
    const e = arr[i]
    const end = e.t + e.dur
    if (t < end) {
      const u = e.dur > 0 ? (t - e.t) / e.dur : 1
      return { x: e.from[0] + (e.to[0] - e.from[0]) * u, y: e.from[1] + (e.to[1] - e.from[1]) * u, team: e.team, inFlight: e.type !== 'carry', holder: e.type === 'carry' ? e.num : null, interpolated: false }
    }
    const next = arr[i + 1]
    const postTeam: Team = e.outcome === 'lost' || e.type === 'shot' ? (e.team === 'h' ? 'a' : 'h') : e.team
    let x = e.to[0]
    let y = e.to[1]
    if (next && Math.hypot(next.from[0] - x, next.from[1] - y) > 1.5 && t >= next.t - 1.2) {
      x = next.from[0]
      y = next.from[1]
    }
    const holder = next ? next.num : e.toNum ?? null
    return { x, y, team: next ? next.team : postTeam, inFlight: false, holder, interpolated: false }
  }

  /** Ball position averaged over a short window: what the formation reacts to. */
  private smoothBall(t: number): V2 {
    let sx = 0
    let sy = 0
    const offs = [-1, -0.5, 0, 0.5, 1, 1.5, 2]
    for (const o of offs) {
      const b = this.ballAt(clamp(t + o, 0, this.opts.duration))
      sx += b.x
      sy += b.y
    }
    return [sx / offs.length, sy / offs.length]
  }

  private positionsAt(t: number, out: Float64Array) {
    const period = this.periodAt(t)
    const sb = this.smoothBall(t)
    for (let i = 0; i < SLOTS.length; i++) {
      const { team, num } = SLOTS[i]
      const nat = slotPos(team, num, sb, period, t)
      const list = this.anchors[i]
      let sw = 0
      let dx = 0
      let dy = 0
      if (list.length) {
        // first anchor with time >= t - 3.4
        let lo = 0
        let hi = list.length
        const from = t - 3.4
        while (lo < hi) {
          const mid = (lo + hi) >> 1
          if (list[mid].t < from) lo = mid + 1
          else hi = mid
        }
        for (let k = lo; k < list.length; k++) {
          const a = list[k]
          const dt = t - a.t
          if (dt < -3.4) break
          const w = dt < 0 ? smoothstep(1 + dt / a.lin) : smoothstep(1 - dt / a.lout)
          if (w <= 0) continue
          sw += w
          dx += w * (a.x - nat[0])
          dy += w * (a.y - nat[1])
        }
      }
      const norm = sw > 1 ? 1 / sw : 1
      out[i * 2] = nat[0] + dx * norm
      out[i * 2 + 1] = nat[1] + dy * norm
    }
  }

  private p0 = new Float64Array(SLOTS.length * 2)
  private pm = new Float64Array(SLOTS.length * 2)
  private pp = new Float64Array(SLOTS.length * 2)

  frame(t: number): Frame {
    const tt = clamp(t, 0, this.opts.duration)
    const ball = this.ballAt(tt)
    const players: PlayerFrame[] = []
    if (this.opts.players) {
      this.positionsAt(tt, this.p0)
      this.positionsAt(tt - 0.2, this.pm)
      this.positionsAt(tt + 0.2, this.pp)
      for (let i = 0; i < SLOTS.length; i++) {
        const { team, num } = SLOTS[i]
        if (team === 'h' && !this.opts.showHome) continue
        if (team === 'a' && !this.opts.showAway) continue
        let vx = (this.pp[i * 2] - this.pm[i * 2]) / 0.4
        let vy = (this.pp[i * 2 + 1] - this.pm[i * 2 + 1]) / 0.4
        // The half-time end swap is a teleport, not running. Cap at a plausible top speed.
        const sp = Math.hypot(vx, vy)
        if (sp > 10.5) {
          vx = sp > 14 ? 0 : (vx / sp) * 10.5
          vy = sp > 14 ? 0 : (vy / sp) * 10.5
        }
        players.push({ team, num, x: this.p0[i * 2], y: this.p0[i * 2 + 1], vx, vy, speed: Math.hypot(vx, vy) })
      }
    }
    if (!this.opts.showBall) ball.interpolated = true
    return { t: tt, period: this.periodAt(tt), players, ball, confidence: this.confidenceAt(tt) }
  }

  /** Cumulative distance (metres) per slot at time t, sampled at 2 Hz and cached. */
  distanceAt(team: Team, num: number, t: number): number {
    if (!this.opts.players) return 0
    if (!this.distCache) {
      const n = Math.ceil(this.opts.duration / Engine.DIST_STEP) + 1
      const cache = SLOTS.map(() => new Float32Array(n))
      const prev = new Float64Array(SLOTS.length * 2)
      const cur = new Float64Array(SLOTS.length * 2)
      this.positionsAt(0, prev)
      for (let k = 1; k < n; k++) {
        this.positionsAt(k * Engine.DIST_STEP, cur)
        for (let i = 0; i < SLOTS.length; i++) {
          const step = Math.hypot(cur[i * 2] - prev[i * 2], cur[i * 2 + 1] - prev[i * 2 + 1])
          // ignore the end-swap at half-time
          cache[i][k] = cache[i][k - 1] + (step > 14 ? 0 : step)
          prev[i * 2] = cur[i * 2]
          prev[i * 2 + 1] = cur[i * 2 + 1]
        }
      }
      this.distCache = cache
    }
    const i = slotIndex(team, num)
    const f = clamp(t / Engine.DIST_STEP, 0, this.distCache[i].length - 1)
    const k = Math.floor(f)
    const a = this.distCache[i][k]
    const b = this.distCache[i][Math.min(k + 1, this.distCache[i].length - 1)]
    return a + (b - a) * (f - k)
  }
}
