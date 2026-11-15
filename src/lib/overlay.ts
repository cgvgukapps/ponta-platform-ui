import { HEX_CENTRES, HEX_COUNT } from './pitch'
import { valueAt, toFrame, SLOTS, PITCH_L, PITCH_W, type PlayerFrame } from './engine'
import type { Team } from './types'
import { clamp } from './prng'

const VMAX = 7.4

/** Pressure index on a player: 1 at ~1 m from the nearest opponent, 0 at ~9 m. */
export function pressureIndex(p: PlayerFrame, players: PlayerFrame[]): number {
  let d = Infinity
  for (const q of players) {
    if (q.team === p.team) continue
    const dd = Math.hypot(q.x - p.x, q.y - p.y)
    if (dd < d) d = dd
  }
  if (!isFinite(d)) return 0
  return clamp(1 - (d - 1) / 8, 0, 1)
}

export interface Fields {
  pHome: Float32Array // 0..1 per hex: how likely the home team reaches it first
  share: Float32Array // per slot: share of hexes this player reaches first (0..1)
  value: Float32Array // 0..1 per hex, value of the ball there for the team in possession
  crowd: Float32Array // players within 6 m of each hex
}
export const makeFields = (): Fields => ({ pHome: new Float32Array(HEX_COUNT), share: new Float32Array(SLOTS.length), value: new Float32Array(HEX_COUNT), crowd: new Float32Array(HEX_COUNT) })

/** Time-to-reach control model, per hexagon. Illustrative: a real engine would replace it. */
export function computeControl(players: PlayerFrame[], f: Fields) {
  f.share.fill(0)
  const n = players.length
  const px = new Float32Array(n)
  const py = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    px[i] = players[i].x + players[i].vx * 0.35
    py[i] = players[i].y + players[i].vy * 0.35
  }
  for (let h = 0; h < HEX_COUNT; h++) {
    const [cx, cy] = HEX_CENTRES[h]
    let tH = 99
    let tA = 99
    let best = -1
    let bt = 99
    let crowd = 0
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(px[i] - cx, py[i] - cy)
      const tt = 0.25 + d / VMAX
      if (players[i].team === 'h') {
        if (tt < tH) tH = tt
      } else if (tt < tA) tA = tt
      if (tt < bt) {
        bt = tt
        best = i
      }
      if (d < 6) crowd++
    }
    f.pHome[h] = tH === 99 ? 0 : tA === 99 ? 1 : 1 / (1 + Math.exp(-(tA - tH) * 2.4))
    f.crowd[h] = crowd
    if (best >= 0) {
      const p = players[best]
      const idx = SLOTS.findIndex((s) => s.team === p.team && s.num === p.num)
      if (idx >= 0) f.share[idx] += 1 / HEX_COUNT
    }
  }
}

/** Value of the ball per hexagon for the team in possession, nudged by who controls the zone. */
export function computeValue(poss: Team, period: 1 | 2, f: Fields) {
  for (let h = 0; h < HEX_COUNT; h++) {
    const [cx, cy] = HEX_CENTRES[h]
    const [fx, fy] = toFrame(poss, period, [clamp(cx, 0, PITCH_L), clamp(cy, 0, PITCH_W)])
    const base = valueAt(fx, fy)
    const control = poss === 'h' ? f.pHome[h] : 1 - f.pHome[h]
    f.value[h] = clamp((base * (0.55 + 0.45 * control)) / 0.62, 0, 1)
  }
}
