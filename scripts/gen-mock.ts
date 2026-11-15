/**
 * Generates the three sample event packs (optical, event-only, GPS-only) as JSON.
 * Deterministic: same seed, same output. Run with `npm run gen:mock`.
 * Player identities are pseudonymous ("Home 7"); nothing here refers to a real person.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { mulberry32, clamp } from '../src/lib/prng'
import { Engine, NUMS, dirFor, slotPos, toAbs, toFrame, valueAt, PITCH_L, PITCH_W } from '../src/lib/engine'
import { bandOf } from '../src/lib/bands'
import type { Alt, MatchEvent, Outcome, PackData, Team, V2 } from '../src/lib/types'

const HT = 2790
const END = 5650
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const pt = (p: V2): V2 => [r1(p[0]), r1(p[1])]
const name = (team: Team, num: number) => `${team === 'h' ? 'Home' : 'Away'} ${num}`

interface KeySpec {
  id: string
  t: number
  type: 'pass' | 'carry' | 'run'
  team: Team
  num: number
  toNum?: number
  from: V2 // team frame
  to: V2 // team frame
  press: number
  conf: number
  confNote?: string
  outcome?: Outcome
  ratio?: number
  /** Value at arrival as a multiple of the chosen option's score at release (a run that improved the outcome). */
  arrival?: number
  vA?: number
  vB?: number
  beforeKey?: string
  lead?: number
  forceNext?: { id: string; len: number; press: number; conf: number }
  note?: string
}

interface Cand {
  num: number
  to: V2
  dist: number
  v: number
  p: number
  s: number
  label: string
}

const CONF_NOTES = [
  'Two players partly occluded near the ball',
  'Ball position interpolated across several frames',
  'Crowded area, three players within 2 m of the ball',
]

function generate(cfg: { seed: number; keys: KeySpec[]; eventOnly?: boolean; noRuns?: boolean; confBase?: number; hideChain?: boolean }): MatchEvent[] {
  const rng = mulberry32(cfg.seed)
  const out: MatchEvent[] = []
  const usedIds = new Set(cfg.keys.map((k) => k.id))
  const nextId = () => {
    let id: string
    do id = 'evt_' + (10000 + Math.floor(rng() * 89999))
    while (usedIds.has(id))
    usedIds.add(id)
    return id
  }
  const keys = cfg.keys.filter((k) => !k.beforeKey).sort((a, b) => a.t - b.t)
  const runKeys = cfg.keys.filter((k) => k.beforeKey)
  const confBase = cfg.confBase ?? 0.95

  let t = 12
  let team: Team = 'h'
  let pos: V2 = [40, 34]
  let holder = 5
  let period: 1 | 2 = 1
  let pendingRestart = false
  let forced: KeySpec['forceNext'] | null = null
  let kIdx = 0

  const sampleConf = () => {
    if (cfg.eventOnly) return { conf: r2(0.72 + rng() * 0.16), note: rng() < 0.3 ? 'Event coordinates are rounded in the feed' : undefined }
    if (rng() < 0.07) {
      const c = r2(0.55 + rng() * 0.2)
      return { conf: c, note: CONF_NOTES[Math.floor(rng() * CONF_NOTES.length)] }
    }
    return { conf: r2(clamp(confBase - rng() * 0.07, 0.5, 0.99)), note: undefined }
  }
  const samplePress = (xf: number) => {
    if (rng() < 0.15) return r2(0.7 + rng() * 0.27)
    return r2(clamp(0.1 + 0.55 * rng() ** 1.6 + (xf > 70 ? 0.08 : 0), 0.02, 0.69))
  }

  const absPos = (p: V2) => toAbs(team, period, p)

  /** Candidate receivers for a pass, in team frame. */
  function passCandidates(fromF: V2, holderNum: number, press: number, tt: number): Cand[] {
    const fromAbs = toAbs(team, period, fromF)
    const list: Cand[] = []
    for (const n of NUMS[team]) {
      if (n === holderNum) continue
      const abs = slotPos(team, n, fromAbs, period, tt)
      const to = toFrame(team, period, abs)
      const dist = Math.hypot(to[0] - fromF[0], to[1] - fromF[1])
      if (dist < 4 || dist > 46) continue
      const v = valueAt(to[0], to[1])
      const p = clamp(0.98 - 0.011 * dist - 0.28 * press * Math.min(1, dist / 25), 0.12, 0.98)
      const dx = to[0] - fromF[0]
      const word = dx > 4 ? 'forward' : dx < -4 ? 'back' : 'square'
      list.push({ num: n, to, dist, v, p, s: v * p, label: `${name(team, n)}, ${Math.round(dist)} m ${word}` })
    }
    return list
  }
  function carryCandidates(fromF: V2, press: number): Cand[] {
    const len = 7 + rng() * 6
    const opts: [number, string][] = [[0, 'straight'], [-35, 'diagonal right'], [35, 'diagonal left'], [-70, 'wide right'], [70, 'wide left'], [180, 'back']]
    return opts.map(([deg, word]) => {
      const a = (deg * Math.PI) / 180
      const to: V2 = [clamp(fromF[0] + Math.cos(a) * len, 2, PITCH_L - 2), clamp(fromF[1] + Math.sin(a) * len, 2, PITCH_W - 2)]
      const v = valueAt(to[0], to[1])
      const p = clamp(0.92 - 0.32 * press - (deg === 180 ? 0 : 0.02), 0.2, 0.97)
      return { num: 0, to, dist: len, v, p, s: v * p, label: `Carry ${Math.round(len)} m, ${word}` }
    })
  }
  const pick = (cands: Cand[], tau: number, near = 20) => {
    const w = cands.map((c) => Math.exp(c.s / tau) * Math.exp(-c.dist / near))
    const sum = w.reduce((a, b) => a + b, 0)
    let x = rng() * sum
    for (let i = 0; i < cands.length; i++) {
      x -= w[i]
      if (x <= 0) return cands[i]
    }
    return cands[cands.length - 1]
  }
  const setScore = (c: Cand, s: number) => {
    c.p = clamp(s / c.v, 0.05, 0.99)
    c.s = s
  }

  /** Attach decision-quality working to a pass or carry event. */
  function attachDecision(e: MatchEvent, cands: Cand[], chosen: Cand, spec?: KeySpec) {
    if (spec?.vA !== undefined && spec.vB !== undefined) {
      const others = cands.filter((c) => c !== chosen).sort((a, b) => b.s - a.s)
      setScore(chosen, spec.vA)
      if (others[0]) setScore(others[0], spec.vB)
    } else if (spec?.ratio !== undefined) {
      const others = cands.filter((c) => c !== chosen).sort((a, b) => b.s - a.s)
      const bestOther = others[0]?.s ?? chosen.s
      setScore(chosen, spec.ratio >= 0.99 ? bestOther * 1.03 : bestOther * spec.ratio)
    }
    const sorted = [...cands].sort((a, b) => b.s - a.s)
    const top = sorted.slice(0, 4)
    if (!top.includes(chosen)) top[3] = chosen
    top.sort((a, b) => b.s - a.s)
    const best = sorted[0]
    const vA = chosen.s
    const vB = best.s
    const ratio = clamp(vA / vB, 0, 1)
    const alts: Alt[] = top.map((c, i) => ({ to: pt(absPosFor(e, c.to)), v: r2(c.v), p: r2(c.p), s: r2(c.s), label: c.label, rank: i + 1, num: c.num || undefined, chosen: c === chosen || undefined }))
    if (cfg.eventOnly) {
      const b = bandOf(ratio)
      e.est = { lo: bandOf(ratio - 0.14), hi: bandOf(ratio + 0.14) }
      e.note = b // internal hint only
      delete e.note
    } else {
      // vA is the value at arrival. Without a scripted run it equals the chosen option's score at release.
      e.vA = r2(spec?.arrival ? vA * spec.arrival : vA)
      e.vB = r2(vB)
      e.dq = r2(clamp(e.vA / e.vB, 0, 1.5))
      e.band = bandOf(e.dq)
      e.alts = alts
    }
  }
  const absPosFor = (e: MatchEvent, f: V2) => toAbs(e.team, e.period, f)

  const baseEvent = (type: MatchEvent['type'], tEv: number, dur: number, tm: Team, num: number, fromF: V2, toF: V2, outcome: Outcome, press: number, id?: string): MatchEvent => {
    const c = sampleConf()
    return {
      id: id ?? nextId(),
      t: r2(tEv),
      dur: r2(dur),
      type,
      team: tm,
      num,
      from: pt(toAbs(tm, period, fromF)),
      to: pt(toAbs(tm, period, toF)),
      outcome,
      press: r2(press),
      conf: c.conf,
      confNote: c.note,
      period,
      hidden: cfg.hideChain || undefined,
      restart: pendingRestart || undefined,
    }
  }

  function defensiveAfter(lostAbs: V2, atT: number, oppTeam: Team) {
    // nearest opposition slot recovers the ball
    const ranked = NUMS[oppTeam]
      .map((n) => ({ n, p: slotPos(oppTeam, n, lostAbs, period, atT) }))
      .sort((a, b) => Math.hypot(a.p[0] - lostAbs[0], a.p[1] - lostAbs[1]) - Math.hypot(b.p[0] - lostAbs[0], b.p[1] - lostAbs[1]))
    const n = ranked[0].n
    const e: MatchEvent = {
      id: nextId(),
      t: r2(atT),
      dur: 0,
      type: 'defensive',
      team: oppTeam,
      num: n,
      from: pt(lostAbs),
      to: pt(lostAbs),
      outcome: 'won',
      press: 0,
      conf: sampleConf().conf,
      period,
      hidden: cfg.hideChain || undefined,
    }
    out.push(e)
    return n
  }

  function halftime() {
    period = 2
    team = 'a'
    pos = [52.5, 34]
    holder = 6
    t = HT + 4
    pendingRestart = true
  }

  /** One possession step. `spec` marks a key event; `fx` constrains a forced follow-up. */
  function step(opts: { spec?: KeySpec; target?: V2; forceReceiver?: number; fx?: NonNullable<KeySpec['forceNext']>; holdOverride?: number } = {}) {
    const { spec, fx } = opts
    const press = spec ? spec.press : fx ? fx.press : samplePress(pos[0])
    const hold = opts.holdOverride ?? 0.8 + rng() * 2.0
    let tEv = t + hold
    if (spec) tEv = spec.t
    const doShot = !spec && !fx && !opts.target && pos[0] > 78 && rng() < 0.1
    const doCarry = fx ? true : spec ? spec.type === 'carry' : !opts.target && !doShot && holder !== 1 && rng() < 0.17

    if (doShot) {
      const dur = 0.6 + rng() * 0.3
      const toF: V2 = [PITCH_L, 34 + (rng() - 0.5) * 11]
      const roll = rng()
      const outcome: Outcome = roll < 0.06 ? 'goal' : roll < 0.36 ? 'saved' : roll < 0.72 ? 'off_target' : 'blocked'
      const e = baseEvent('shot', tEv, dur, team, holder, pos, toF, outcome, press)
      out.push(e)
      pendingRestart = false
      t = tEv + dur
      const opp: Team = team === 'h' ? 'a' : 'h'
      if (outcome === 'goal') {
        team = opp
        pos = [52.5, 34]
        holder = 6
        t += 24 + rng() * 8
        // keep the kick-off in the same half
        pendingRestart = true
      } else {
        team = opp
        pos = [5, 34]
        holder = 1
        t += 3 + rng() * 5
        pendingRestart = true
      }
      return
    }

    if (doCarry) {
      const len = fx ? fx.len : 7 + rng() * 9
      const cands = carryCandidates(pos, press)
      let chosen: Cand
      if (fx) {
        // straight, forward, long
        chosen = cands[0]
        chosen.to = [clamp(pos[0] + len, 2, PITCH_L - 2), pos[1] + (rng() - 0.5) * 4]
        chosen.dist = len
        chosen.v = valueAt(chosen.to[0], chosen.to[1])
        chosen.s = chosen.v * chosen.p
        chosen.label = `Carry ${Math.round(len)} m, straight`
      } else if (spec) {
        chosen = cands[0]
        chosen.to = spec.to
        chosen.dist = Math.hypot(spec.to[0] - pos[0], spec.to[1] - pos[1])
        chosen.v = valueAt(chosen.to[0], chosen.to[1])
        chosen.s = chosen.v * chosen.p
        chosen.label = `Carry ${Math.round(chosen.dist)} m, forward`
      } else chosen = pick(cands, 0.07, 30)
      const dist = Math.hypot(chosen.to[0] - pos[0], chosen.to[1] - pos[1])
      const dur = Math.max(1.2, dist / (4.2 + rng() * 2.2))
      const lossP = clamp(0.04 + 0.3 * Math.max(0, press - 0.6), 0, 0.4)
      const lost = !spec && !fx && rng() < lossP
      const e = baseEvent('carry', tEv, dur, team, holder, pos, chosen.to, lost ? 'lost' : 'complete', press, spec?.id ?? fx?.id)
      if (spec) {
        e.conf = spec.conf
        e.confNote = spec.confNote
      } else if (fx) e.conf = fx.conf
      attachDecision(e, cands, chosen, spec)
      out.push(e)
      pendingRestart = false
      t = tEv + dur
      pos = chosen.to
      if (lost) {
        const opp: Team = team === 'h' ? 'a' : 'h'
        const abs = absPos(pos)
        const n = defensiveAfter(abs, t, opp)
        team = opp
        pos = toFrame(opp, period, abs)
        holder = n
      }
      return
    }

    // Pass
    const cands = passCandidates(pos, holder, press, tEv)
    if (!cands.length) {
      t += 2
      return
    }
    let chosen: Cand
    if (spec) {
      const rec = cands.find((c) => c.num === spec.toNum) ?? cands[0]
      rec.to = spec.to
      rec.dist = Math.hypot(spec.to[0] - pos[0], spec.to[1] - pos[1])
      rec.v = valueAt(rec.to[0], rec.to[1])
      rec.p = clamp(0.98 - 0.011 * rec.dist - 0.28 * press * Math.min(1, rec.dist / 25), 0.12, 0.98)
      rec.s = rec.v * rec.p
      const dx = rec.to[0] - pos[0]
      rec.label = `${name(team, rec.num)}, ${Math.round(rec.dist)} m ${dx > 4 ? 'forward' : dx < -4 ? 'back' : 'square'}`
      chosen = rec
    } else if (opts.forceReceiver) {
      chosen = cands.find((c) => c.num === opts.forceReceiver) ?? pick(cands, 0.07)
    } else if (opts.target) {
      const tgt = opts.target
      chosen = [...cands].sort((a, b) => Math.hypot(a.to[0] - tgt[0], a.to[1] - tgt[1]) - Math.hypot(b.to[0] - tgt[0], b.to[1] - tgt[1]))[0]
    } else chosen = pick(cands, 0.11, 24)

    const speed = 11 + rng() * 8
    let dur = clamp(chosen.dist / speed, 0.45, 3.2)
    const lossP = !spec && !opts.forceReceiver && !opts.target ? clamp(0.05 + 0.4 * Math.max(0, press - 0.5) + (chosen.dist > 30 ? 0.12 : 0), 0, 0.7) : 0
    const lost = spec ? spec.outcome === 'lost' : rng() < lossP
    let toF = chosen.to
    if (lost) {
      const f = spec ? 1 : 0.45 + rng() * 0.4
      toF = [pos[0] + (chosen.to[0] - pos[0]) * f, pos[1] + (chosen.to[1] - pos[1]) * f]
      dur = Math.max(0.4, dur * f)
    }
    const e = baseEvent('pass', tEv, dur, team, holder, pos, toF, lost ? 'lost' : 'complete', press, spec?.id)
    if (!lost) e.toNum = chosen.num
    if (spec) {
      e.conf = spec.conf
      e.confNote = spec.confNote
    }
    attachDecision(e, cands, chosen, spec)
    out.push(e)
    pendingRestart = false

    // Off-ball run that ends where the pass arrives (receiver), plus an occasional decoy.
    if (!cfg.noRuns && !spec && !opts.target) {
      if (!lost && chosen.dist > 14 && rng() < 0.32) addRun(chosen.num, toF, tEv + dur, e)
      else if (rng() < 0.1) {
        const decoy = NUMS[team].filter((n) => n !== holder && n !== chosen.num && n !== 1)[Math.floor(rng() * 9)]
        if (decoy) {
          const base = toFrame(team, period, slotPos(team, decoy, toAbs(team, period, pos), period, tEv))
          addRun(decoy, [clamp(base[0] + 12 + rng() * 8, 3, 100), clamp(base[1] + (rng() - 0.5) * 14, 3, 65)], tEv + 1.5, e)
        }
      }
    }

    t = tEv + dur
    if (lost) {
      const opp: Team = team === 'h' ? 'a' : 'h'
      const abs = absPos(toF)
      const n = defensiveAfter(abs, t, opp)
      team = opp
      pos = toFrame(opp, period, abs)
      holder = n
    } else {
      pos = toF
      holder = chosen.num
    }
  }

  function addRun(num: number, toF: V2, arriveT: number, ref: MatchEvent) {
    const abs0 = toAbs(team, period, pos)
    const runDur = clamp(2 + rng() * 1.6, 1.4, 3.6)
    const t0 = arriveT - runDur
    const startAbs = slotPos(team, num, abs0, period, t0)
    const startF = toFrame(team, period, startAbs)
    const e: MatchEvent = {
      id: nextId(),
      t: r2(t0),
      dur: r2(runDur),
      type: 'run',
      team,
      num,
      from: pt(startAbs),
      to: pt(toAbs(team, period, toF)),
      outcome: 'n/a',
      press: 0,
      conf: sampleConf().conf,
      period,
      ovmFrom: r2(valueAt(startF[0], startF[1])),
      ovmTo: r2(valueAt(toF[0], toF[1])),
      hidden: cfg.hideChain || undefined,
    }
    e.ovm = r2(e.ovmTo! - e.ovmFrom!)
    void ref
    out.push(e)
  }

  // ------------------------------------------------------------------ main loop
  let guard = 0
  while (t < END && guard++ < 20000) {
    if (period === 1 && t >= HT - 8) {
      halftime()
      continue
    }
    const k = keys[kIdx]
    if (forced) {
      const fx = forced
      forced = null
      step({ fx })
      continue
    }
    if (k && k.t - t < 34) {
      // steer towards the key event
      if (team !== k.team) {
        // force a turnover under high pressure to hand the ball over
        const saved = rng
        void saved
        const press = 0.82
        const cands = passCandidates(pos, holder, press, t + 1)
        const chosen = cands.sort((a, b) => b.dist - a.dist)[0]
        const toF: V2 = [pos[0] + (chosen.to[0] - pos[0]) * 0.55, pos[1] + (chosen.to[1] - pos[1]) * 0.55]
        const e = baseEvent('pass', t + 1, 0.8, team, holder, pos, toF, 'lost', press)
        attachDecision(e, cands, chosen)
        out.push(e)
        pendingRestart = false
        t += 1.8
        const opp: Team = team === 'h' ? 'a' : 'h'
        const abs = absPos(toF)
        const n = defensiveAfter(abs, t, opp)
        team = opp
        pos = toFrame(opp, period, abs)
        holder = n
        continue
      }
      const remaining = k.t - t
      const d = Math.hypot(pos[0] - k.from[0], pos[1] - k.from[1])
      if (holder === k.num && remaining < 14) {
        // actor already has the ball: wait, then act
        step({ spec: k })
      } else if (remaining > 11 && d > 5) {
        step({ target: k.from, holdOverride: 0.6 + rng() * 0.9 })
        continue
      } else {
        // connecting ball to the actor
        if (holder !== k.num) {
          const d2 = Math.hypot(pos[0] - k.from[0], pos[1] - k.from[1])
          const dur = clamp(d2 / 16, 0.5, 3)
          const tEv = Math.max(t + 0.5, k.t - dur - 0.6)
          const e = baseEvent('pass', tEv, dur, team, holder, pos, k.from, 'complete', clamp(k.press - 0.1, 0.05, 0.9))
          e.toNum = k.num
          attachDecision(e, [{ num: k.num, to: k.from, dist: d2, v: valueAt(k.from[0], k.from[1]), p: 0.8, s: valueAt(k.from[0], k.from[1]) * 0.8, label: `${name(team, k.num)}, ${Math.round(d2)} m` }], { num: k.num, to: k.from, dist: d2, v: valueAt(k.from[0], k.from[1]), p: 0.8, s: valueAt(k.from[0], k.from[1]) * 0.8, label: '' })
          out.push(e)
          t = tEv + dur
          pos = k.from
          holder = k.num
          pendingRestart = false
        }
        pos = k.from
        step({ spec: k })
      }
      // after the key event
      if (k.forceNext) forced = k.forceNext
      kIdx++
      continue
    }
    step()
  }

  // Off-ball runs that belong to a key event ("a run that was not found")
  for (const rk of runKeys) {
    const ref = out.find((e) => e.id === rk.beforeKey)
    if (!ref) continue
    const dur = 2.3
    const startF = rk.from
    const toF = rk.to
    const e: MatchEvent = {
      id: rk.id,
      t: r2(ref.t - (rk.lead ?? 2.4)),
      dur,
      type: 'run',
      team: rk.team,
      num: rk.num,
      from: pt(toAbs(rk.team, ref.period, startF)),
      to: pt(toAbs(rk.team, ref.period, toF)),
      outcome: 'n/a',
      press: 0,
      conf: rk.conf,
      confNote: rk.confNote,
      period: ref.period,
      ovmFrom: r2(valueAt(startF[0], startF[1])),
      ovmTo: r2(valueAt(toF[0], toF[1])),
      key: true,
    }
    e.ovm = r2(e.ovmTo! - e.ovmFrom!)
    out.push(e)
  }
  for (const k of cfg.keys) {
    const e = out.find((x) => x.id === k.id)
    if (e) e.key = true
  }
  out.sort((a, b) => a.t - b.t)
  return out
}

// --------------------------------------------------------------------------- key events
const optical: KeySpec[] = [
  { id: 'evt_41207', t: 468, type: 'pass', team: 'h', num: 5, toNum: 6, from: [25, 40], to: [48, 38], press: 0.27, conf: 0.94, ratio: 0.97, arrival: 1.18 },
  { id: 'evt_41893', t: 680, type: 'pass', team: 'h', num: 3, toNum: 11, from: [34, 12], to: [56, 14], press: 0.41, conf: 0.93, ratio: 0.86 },
  { id: 'evt_52660', t: 1145, type: 'pass', team: 'h', num: 4, toNum: 6, from: [30, 30], to: [49, 38], press: 0.84, conf: 0.9, ratio: 0.66 },
  { id: 'evt_60318', t: 1421, type: 'pass', team: 'h', num: 6, from: [44, 36], to: [58, 34], press: 0.88, conf: 0.92, outcome: 'lost', ratio: 0.22 },
  { id: 'evt_66190', t: 1660, type: 'pass', team: 'h', num: 8, toNum: 10, from: [53, 29], to: [61, 36], press: 0.86, conf: 0.58, confNote: 'Two players partly occluded near the ball', ratio: 0.6 },
  { id: 'evt_70055', t: 1790, type: 'pass', team: 'h', num: 5, toNum: 1, from: [27, 40], to: [6, 35], press: 0.78, conf: 0.91, ratio: 0.6 },
  { id: 'evt_99482', t: 2052, type: 'pass', team: 'h', num: 10, toNum: 8, from: [62, 38], to: [57, 24], press: 0.34, conf: 0.91, vA: 0.27, vB: 0.42 },
  { id: 'evt_84102', t: 3500, type: 'pass', team: 'h', num: 6, from: [47, 34], to: [60, 30], press: 0.76, conf: 0.9, outcome: 'lost', ratio: 0.3 },
  { id: 'evt_88420', t: 3156, type: 'pass', team: 'h', num: 8, from: [58, 30], to: [66, 33], press: 0.81, conf: 0.93, outcome: 'lost', ratio: 0.28, forceNext: { id: 'evt_88433', len: 26, press: 0.15, conf: 0.94 } },
  { id: 'evt_93017', t: 3676, type: 'pass', team: 'h', num: 6, toNum: 8, from: [60, 40], to: [57, 26], press: 0.46, conf: 0.9, ratio: 0.38 },
  { id: 'evt_93012', t: 0, type: 'run', team: 'h', num: 9, from: [72, 26], to: [91, 36], press: 0, conf: 0.58, confNote: 'Ball position interpolated across several frames', beforeKey: 'evt_93017', lead: 2.2 },
  { id: 'evt_90531', t: 4124, type: 'pass', team: 'h', num: 4, from: [38, 26], to: [50, 32], press: 0.83, conf: 0.89, outcome: 'lost', ratio: 0.24 },
  { id: 'evt_96877', t: 4989, type: 'pass', team: 'h', num: 8, from: [55, 36], to: [66, 30], press: 0.79, conf: 0.9, outcome: 'lost', ratio: 0.33 },
]

const eventOnlyKeys: KeySpec[] = [
  { id: 'evt_23104', t: 540, type: 'pass', team: 'h', num: 5, toNum: 6, from: [25, 40], to: [47, 38], press: 0.3, conf: 0.84, ratio: 0.9 },
  { id: 'evt_27355', t: 1330, type: 'pass', team: 'h', num: 6, toNum: 10, from: [50, 38], to: [66, 36], press: 0.52, conf: 0.8, ratio: 0.75 },
  { id: 'evt_31220', t: 2210, type: 'pass', team: 'h', num: 4, from: [34, 28], to: [56, 33], press: 0.8, conf: 0.76, outcome: 'lost', ratio: 0.3 },
  { id: 'evt_36098', t: 3320, type: 'pass', team: 'h', num: 8, toNum: 9, from: [58, 30], to: [78, 34], press: 0.4, conf: 0.82, ratio: 0.62 },
  { id: 'evt_39871', t: 4210, type: 'pass', team: 'h', num: 6, from: [48, 36], to: [62, 33], press: 0.84, conf: 0.74, outcome: 'lost', ratio: 0.26 },
  { id: 'evt_42650', t: 4880, type: 'pass', team: 'h', num: 10, toNum: 11, from: [72, 40], to: [84, 20], press: 0.35, conf: 0.8, ratio: 0.6 },
]

// ----------------------------------------------------------------------------- build
const outDir = new URL('../src/mock/packs/', import.meta.url).pathname
mkdirSync(outDir, { recursive: true })

function write(name: string, pack: PackData) {
  const strip = pack.events.map((e) => {
    const o: Record<string, unknown> = { ...e }
    if (e.hidden) for (const k of ['alts', 'vA', 'vB', 'dq', 'band', 'est']) delete o[k]
    for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]
    return o
  })
  writeFileSync(outDir + name, JSON.stringify({ ...pack, events: strip }))
  const kb = (JSON.stringify({ ...pack, events: strip }).length / 1024).toFixed(0)
  console.log(`${name}: ${pack.events.length} events, ${kb} KB`)
}

// Optical
const opt = generate({ seed: 20260101, keys: optical })
write('optical.json', { pack: 'optical', htAt: HT, duration: END, teams: { showHome: true, showAway: true, showBall: true, players: true }, events: opt })

// Event-only
const evo = generate({ seed: 777, keys: eventOnlyKeys, eventOnly: true, noRuns: true, confBase: 0.84 })
write('events.json', { pack: 'events', htAt: HT, duration: END, teams: { showHome: true, showAway: true, showBall: false, players: false }, events: evo })

// GPS-only: hidden guide chain drives the block; the visible events are physical efforts.
const guide = generate({ seed: 4242, keys: [], noRuns: true, hideChain: true })
const gpsEngine = new Engine(guide, { htAt: HT, duration: END, players: true, showHome: true, showAway: true, showBall: false })
const gr = mulberry32(99)
const efforts: MatchEvent[] = []
const gpsKeys: [string, number, number][] = [
  ['evt_71013', 612, 7],
  ['evt_71042', 1488, 11],
  ['evt_71077', 2301, 9],
  ['evt_71105', 3410, 7],
  ['evt_71131', 3652, 7],
  ['evt_71190', 4580, 11],
  ['evt_71226', 5320, 10],
]
const used = new Set(gpsKeys.map((k) => k[0]))
let te = 90
const kinds: [MatchEvent['effort'] extends infer T ? T : never, number][] = [] as never
void kinds
const mkEffort = (id: string, tt: number, num: number, forceKind?: 'sprint' | 'high_speed' | 'acceleration') => {
  const f = gpsEngine.frame(tt)
  const p = f.players.find((q) => q.team === 'h' && q.num === num)!
  const period = tt < HT ? 1 : 2
  const dirX = dirFor('h', period)
  const sprint = forceKind ? forceKind === 'sprint' : gr() < 0.45
  const speed = sprint ? 7.1 + gr() * 1.5 : 5.6 + gr() * 1.2
  const dist = sprint ? 22 + gr() * 22 : 14 + gr() * 12
  const ang = (gr() - 0.5) * 1.2 + (gr() < 0.28 ? Math.PI : 0)
  const to: V2 = [clamp(p.x + Math.cos(ang) * dist * dirX, 3, PITCH_L - 3), clamp(p.y + Math.sin(ang) * dist * 0.5, 3, PITCH_W - 3)]
  const real = Math.hypot(to[0] - p.x, to[1] - p.y)
  const dur = real / speed
  const e: MatchEvent = {
    id,
    t: r2(tt),
    dur: r2(dur),
    type: 'effort',
    team: 'h',
    num,
    from: pt([p.x, p.y]),
    to: pt(to),
    outcome: 'n/a',
    press: 0,
    conf: r2(0.82 + gr() * 0.15),
    period,
    effort: { kind: forceKind ?? (sprint ? 'sprint' : 'high_speed'), peak: r2(speed * 1.08), dist: r1(real) },
  }
  return e
}
for (const [id, tt, num] of gpsKeys) {
  const e = mkEffort(id, tt, num, 'sprint')
  e.key = true
  efforts.push(e)
}
while (te < END - 60) {
  if (Math.abs(te - HT) > 20 && !gpsKeys.some((k) => Math.abs(k[1] - te) < 20)) {
    let id: string
    do id = 'evt_' + (72000 + Math.floor(gr() * 20000))
    while (used.has(id))
    used.add(id)
    const num = 2 + Math.floor(gr() * 10)
    efforts.push(mkEffort(id, te, Math.min(num, 11)))
  }
  te += 38 + gr() * 55
}
// low-confidence effort for the brief
const lowEffort = efforts.find((e) => e.id === 'evt_71131')!
lowEffort.conf = 0.66
lowEffort.confNote = 'Signal dropped for several samples during the effort'
const gpsEvents = [...guide, ...efforts].sort((a, b) => a.t - b.t)
write('gps.json', { pack: 'gps', htAt: HT, duration: END, teams: { showHome: true, showAway: false, showBall: false, players: true }, events: gpsEvents })

// ------------------------------------------------------------------------- sanity print
const show = (ev: MatchEvent[], ids: string[]) => {
  for (const id of ids) {
    const e = ev.find((x) => x.id === id)
    if (!e) {
      console.log('  MISSING', id)
      continue
    }
    const mm = `${Math.floor(e.t / 60)}:${String(Math.floor(e.t % 60)).padStart(2, '0')}`
    console.log(`  ${id} ${mm} ${e.type} ${e.team}${e.num}->${e.toNum ?? '-'} ${e.outcome} press ${e.press} conf ${e.conf} vA ${e.vA} vB ${e.vB} dq ${e.dq} ${e.band} from ${e.from} to ${e.to}`)
  }
}
show(opt, optical.map((k) => k.id).concat(['evt_88433']))
const hiLossP2 = opt.filter((e) => e.team === 'h' && e.outcome === 'lost' && e.press >= 0.7 && e.t >= HT && e.type === 'pass').length
console.log('optical: high-pressure home losses in 2nd half:', hiLossP2)
const bandCounts: Record<string, number> = {}
for (const e of opt) if (e.band) bandCounts[e.band] = (bandCounts[e.band] ?? 0) + 1
console.log('band distribution', bandCounts)
void dirFor
