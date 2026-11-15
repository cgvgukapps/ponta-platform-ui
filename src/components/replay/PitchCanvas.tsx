import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LoadedPack } from '@/api/packs'
import type { MatchEvent, Team } from '@/lib/types'
import { HEX_CENTRES, HEX_COUNT, HEX_CORNERS, PITCH_PATHS, PITCH_SPOTS } from '@/lib/pitch'
import { PITCH_L, PITCH_W, type Frame, type PlayerFrame } from '@/lib/engine'
import { computeControl, computeValue, makeFields, pressureIndex } from '@/lib/overlay'
import { heatLUT, readTheme, rgbOf } from '@/lib/theme'
import { playerLabel } from '@/lib/events'
import { t as tx } from '@/i18n'
import type { PlaybackStore } from './playback'

export interface Overlays {
  control: boolean
  value: boolean
  corridors: boolean
  carries: boolean
  confidence: boolean
}

const LINES = PITCH_PATHS.map((d) => new Path2D(d))
const HEX_PATHS = HEX_CENTRES.map(([cx, cy]) => {
  const p = new Path2D()
  HEX_CORNERS.forEach(([dx, dy], i) => (i ? p.lineTo(cx + dx, cy + dy) : p.moveTo(cx + dx, cy + dy)))
  p.closePath()
  return p
})
function bsearch(events: MatchEvent[], t: number) {
  let lo = 0
  let hi = events.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (events[mid].t <= t) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}

interface Props {
  lp: LoadedPack
  store: PlaybackStore
  overlays: Overlays
  selected: MatchEvent | null
  selectedPlayer: string | null
  onPlayerClick: (key: string | null) => void
  onSize?: (w: number, h: number) => void
}

export function PitchCanvas({ lp, store, overlays, selected, selectedPlayer, onPlayerClick }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 900, h: 600 })
  const lastFrame = useRef<Frame | null>(null)
  const geom = useRef({ ox: 0, oy: 0, s: 1 })
  const [hover, setHover] = useState<{ x: number; y: number; p: PlayerFrame } | null>(null)
  const fields = useMemo(makeFields, [])
  const lut = useMemo(() => heatLUT(readTheme().heat), [])
  const raf = useRef(0)
  const visible = useMemo(() => lp.events.filter((e) => e.type !== 'effort' || e.dur > 0), [lp])
  const stateRef = useRef({ overlays, selected, selectedPlayer })
  stateRef.current = { overlays, selected, selectedPlayer }

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const draw = useCallback(() => {
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const th = readTheme()
    const { overlays: ov, selected: sel, selectedPlayer: selP } = stateRef.current
    const { w, h } = size
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const t = store.t
    const frame = lp.engine.frame(t)
    lastFrame.current = frame

    const pad = 18
    const s = Math.min((w - pad * 2) / (PITCH_L + 4.4), (h - pad * 2) / (PITCH_W + 4.4))
    const ox = (w - PITCH_L * s) / 2
    const oy = (h - PITCH_W * s) / 2
    geom.current = { ox, oy, s }
    const X = (x: number) => ox + x * s
    const Y = (y: number) => oy + y * s

    // Surface
    ctx.fillStyle = th.pitch
    ctx.fillRect(X(-2.2), Y(-2.2), (PITCH_L + 4.4) * s, (PITCH_W + 4.4) * s)

    // Confidence: where tracking is less certain, the zone is drawn fainter and outlined with a
    // dashed edge. Fill is never textured, so the value and control colours stay readable.
    const zoneConf = (i: number) => frame.confidence - 0.045 * fields.crowd[i]
    const fade = (i: number) => (ov.confidence ? 0.45 + 0.55 * Math.min(1, Math.max(0, (zoneConf(i) - 0.5) / 0.4)) : 1)

    // Fields
    const wantControl = ov.control || ov.value || ov.confidence
    if (wantControl && lp.data.teams.players) {
      computeControl(frame.players, fields)
      if (ov.value) computeValue(frame.ball.team, frame.period, fields)
    }

    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(s, s)
    ctx.beginPath()
    ctx.rect(0, 0, PITCH_L, PITCH_W)
    ctx.clip()

    if (lp.data.teams.players && ov.value) {
      for (let i = 0; i < HEX_COUNT; i++) {
        const v = fields.value[i]
        if (v < 0.04) continue
        ctx.fillStyle = `rgba(${lut[Math.round(v * 63)]},${(0.22 + 0.62 * v) * fade(i)})`
        ctx.fill(HEX_PATHS[i])
      }
    }
    if (lp.data.teams.players && ov.control) {
      const [hr, hg, hb] = rgbOf(th.home)
      const [ar, ag, ab] = rgbOf(th.away)
      for (let i = 0; i < HEX_COUNT; i++) {
        const p = fields.pHome[i]
        const strength = Math.abs(p - 0.5) * 2
        const a = (0.03 + 0.27 * Math.pow(strength, 1.1)) * fade(i)
        if (ov.value) {
          // Value is the fill; control is a smaller inner hexagon so the two channels never merge.
          // Contested zones are left empty, which keeps the pitch readable with both overlays on.
          if (strength < 0.6) continue
          const [cx, cy] = HEX_CENTRES[i]
          ctx.save()
          ctx.translate(cx, cy)
          ctx.scale(0.28 + 0.16 * strength, 0.28 + 0.16 * strength)
          ctx.translate(-cx, -cy)
          const k = 0.6 * fade(i)
          ctx.fillStyle = p > 0.5 ? `rgba(${hr},${hg},${hb},${k})` : `rgba(${ar},${ag},${ab},${k})`
          ctx.fill(HEX_PATHS[i])
          ctx.restore()
        } else {
          ctx.fillStyle = p > 0.5 ? `rgba(${hr},${hg},${hb},${a})` : `rgba(${ar},${ag},${ab},${a})`
          ctx.fill(HEX_PATHS[i])
        }
      }
    }
    if (lp.data.teams.players && (ov.control || ov.value)) {
      ctx.strokeStyle = th.hex
      ctx.lineWidth = 0.6 / s
      for (let i = 0; i < HEX_COUNT; i++) ctx.stroke(HEX_PATHS[i])
    }
    // Confidence: dashed outlines, stronger the less certain the zone.
    if (ov.confidence && lp.data.teams.players) {
      ctx.save()
      ctx.strokeStyle = th.fg
      ctx.lineWidth = 1.1 / s
      ctx.setLineDash([2.2 / s, 2.2 / s])
      for (let i = 0; i < HEX_COUNT; i++) {
        const c = zoneConf(i)
        if (c >= 0.8) continue
        ctx.globalAlpha = 0.15 + 0.45 * Math.min(1, (0.8 - c) / 0.3)
        ctx.stroke(HEX_PATHS[i])
      }
      ctx.restore()
    }
    ctx.restore()

    // Lines
    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(s, s)
    ctx.strokeStyle = th.line
    ctx.lineWidth = 1.3 / s
    for (const p of LINES) ctx.stroke(p)
    ctx.fillStyle = th.line
    for (const [sx, sy] of PITCH_SPOTS) {
      ctx.beginPath()
      ctx.arc(sx, sy, 0.3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // Recent event ghosts
    const evs = visible
    const hiIdx = bsearch(evs, t)
    const showEventVec = (e: MatchEvent, alpha: number, dash: boolean) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = th.fg
      ctx.lineWidth = 1.2
      if (dash) ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(X(e.from[0]), Y(e.from[1]))
      ctx.lineTo(X(e.to[0]), Y(e.to[1]))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.arc(X(e.to[0]), Y(e.to[1]), 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    for (let i = hiIdx, n = 0; i >= 0 && n < 7; i--) {
      const e = evs[i]
      const age = t - e.t
      if (age > 5) break
      if (e.type === 'pass' || e.type === 'carry' || e.type === 'shot') {
        showEventVec(e, 0.5 * (1 - age / 5), e.type === 'carry')
        n++
      }
    }

    // Decision overlays for the selected event
    const near = sel && t >= sel.t - 3 && t <= sel.t + sel.dur + 4
    if (sel && near && sel.alts) {
      const show = (sel.type === 'pass' && ov.corridors) || (sel.type === 'carry' && ov.carries)
      if (show) {
        const fx = X(sel.from[0])
        const fy = Y(sel.from[1])
        const alts = [...sel.alts].sort((a, b) => b.rank - a.rank)
        for (const a of alts) {
          const tx = X(a.to[0])
          const ty = Y(a.to[1])
          const ang = Math.atan2(ty - fy, tx - fx)
          const len = Math.hypot(tx - fx, ty - fy)
          const wd = (a.chosen ? 1.8 : 1.5) * s
          ctx.save()
          ctx.translate(fx, fy)
          ctx.rotate(ang)
          if (sel.type === 'pass') {
            ctx.fillStyle = a.chosen ? th.highlight : th.fg
            ctx.globalAlpha = a.chosen ? 0.22 : 0.1
            ctx.fillRect(0, -wd / 2, len, wd)
            ctx.globalAlpha = 1
          }
          ctx.strokeStyle = a.chosen ? th.highlight : th.fg
          ctx.globalAlpha = a.chosen ? 1 : 0.75
          ctx.lineWidth = a.chosen ? 2.4 : 1.4
          if (!a.chosen) ctx.setLineDash(sel.type === 'carry' ? [2, 4] : [6, 3])
          ctx.beginPath()
          ctx.moveTo(0, 0)
          ctx.lineTo(len - 6, 0)
          ctx.stroke()
          ctx.setLineDash([])
          ctx.beginPath()
          ctx.moveTo(len, 0)
          ctx.lineTo(len - 8, -4)
          ctx.lineTo(len - 8, 4)
          ctx.closePath()
          ctx.fillStyle = a.chosen ? th.highlight : th.fg
          ctx.fill()
          ctx.restore()
          // rank marker
          ctx.save()
          ctx.fillStyle = th.canvas
          ctx.strokeStyle = a.chosen ? th.highlight : th.fg
          ctx.lineWidth = 1.5
          const mx = fx + Math.cos(ang) * Math.max(0, len - 18)
          const my = fy + Math.sin(ang) * Math.max(0, len - 18)
          ctx.beginPath()
          ctx.arc(mx, my, 8, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
          ctx.fillStyle = th.fg
          ctx.font = '600 10px "Geist Mono", ui-monospace, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(a.rank), mx, my + 0.5)
          ctx.restore()
        }
      }
    }
    // Selected event marker (always visible: it is the thing being explained)
    if (sel) {
      ctx.save()
      ctx.strokeStyle = th.highlight
      ctx.lineWidth = 2
      const live = near
      ctx.globalAlpha = live ? 1 : 0.5
      if (!sel.alts || !live) {
        ctx.setLineDash(sel.type === 'carry' || sel.type === 'run' ? [2, 4] : [])
        ctx.beginPath()
        ctx.moveTo(X(sel.from[0]), Y(sel.from[1]))
        ctx.lineTo(X(sel.to[0]), Y(sel.to[1]))
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.beginPath()
      ctx.arc(X(sel.from[0]), Y(sel.from[1]), 10, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(X(sel.to[0]) - 5, Y(sel.to[1]))
      ctx.lineTo(X(sel.to[0]), Y(sel.to[1]) - 5)
      ctx.lineTo(X(sel.to[0]) + 5, Y(sel.to[1]))
      ctx.lineTo(X(sel.to[0]), Y(sel.to[1]) + 5)
      ctx.closePath()
      ctx.stroke()
      ctx.restore()
    }

    // Ball trail
    const ball = frame.ball
    if (lp.data.teams.showBall) {
      for (let k = 6; k >= 1; k--) {
        const b = lp.engine.ballAt(Math.max(0, t - k * 0.06))
        ctx.fillStyle = th.fg
        ctx.globalAlpha = 0.045 * (7 - k)
        ctx.beginPath()
        ctx.arc(X(b.x), Y(b.y), 3.2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // Players
    const r = Math.max(9, Math.min(13, s * 1.35))
    ctx.font = `600 ${r > 11 ? 12 : 11}px "Geist Mono", ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const p of frame.players) {
      const key = `${p.team}${p.num}`
      const cx = X(p.x)
      const cy = Y(p.y)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = p.team === 'h' ? th.home : th.away
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = th.pitch
      ctx.stroke()
      if (ov.confidence && frame.confidence < 0.8 && Math.hypot(p.x - ball.x, p.y - ball.y) < 6) {
        ctx.save()
        ctx.setLineDash([1.5, 2.5])
        ctx.strokeStyle = th.fg
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(cx, cy, r + 3.5, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      if (key === selP) {
        ctx.strokeStyle = th.fg
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, r + 3, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.fillStyle = p.team === 'h' ? th.onHome : th.onAway
      ctx.fillText(String(p.num), cx, cy + 0.5)
    }
    if (selP) {
      const p = frame.players.find((q) => `${q.team}${q.num}` === selP)
      if (p) {
        const label = playerLabel(p.team as Team, p.num)
        ctx.font = '500 11px "Geist", system-ui, sans-serif'
        const tw = ctx.measureText(label).width + 10
        const lx = X(p.x) - tw / 2
        const ly = Y(p.y) - r - 22
        ctx.fillStyle = th.canvas
        ctx.fillRect(lx, ly, tw, 18)
        ctx.fillStyle = th.fg
        ctx.fillText(label, X(p.x), ly + 9.5)
      }
    }

    // Ball
    if (lp.data.teams.showBall) {
      const bx = X(ball.x)
      const by = Y(ball.y)
      ctx.beginPath()
      ctx.arc(bx, by, 5, 0, Math.PI * 2)
      if (ball.interpolated) {
        ctx.fillStyle = th.canvas
        ctx.fill()
        ctx.setLineDash([2, 2])
        ctx.strokeStyle = th.fg
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        ctx.fillStyle = th.fg
        ctx.fill()
        ctx.strokeStyle = th.canvas
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
    }

    // Half-time veil
    const ht = lp.data.htAt
    if (t > ht - 6 && t < ht + 3) {
      ctx.fillStyle = th.canvas
      ctx.globalAlpha = 0.72
      ctx.fillRect(X(-2.2), Y(-2.2), (PITCH_L + 4.4) * s, (PITCH_W + 4.4) * s)
      ctx.globalAlpha = 1
      ctx.fillStyle = th.fg
      ctx.font = '500 13px "Geist", system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(tx('replay.half_time'), w / 2, h / 2 - 8)
      ctx.font = '400 12px "Geist", system-ui, sans-serif'
      ctx.fillText(tx('replay.half_time_sub'), w / 2, h / 2 + 12)
    }
  }, [size, lp, store, fields, lut, visible])

  // Redraw on any store change (coalesced to one per animation frame) and on prop changes.
  useEffect(() => {
    const schedule = () => {
      if (raf.current) return
      raf.current = requestAnimationFrame(() => {
        raf.current = 0
        draw()
      })
    }
    schedule()
    const unsub = store.subscribe(schedule)
    return () => {
      unsub()
      cancelAnimationFrame(raf.current)
      raf.current = 0
    }
  }, [draw, store, overlays, selected, selectedPlayer])

  const pick = (e: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const f = lastFrame.current
    if (!f) return null
    const { ox, oy, s } = geom.current
    let best: PlayerFrame | null = null
    let bd = 15
    for (const p of f.players) {
      const d = Math.hypot(ox + p.x * s - x, oy + p.y * s - y)
      if (d < bd) {
        bd = d
        best = p
      }
    }
    return best ? { x, y, p: best } : null
  }
  const pressure = hover && lastFrame.current ? pressureIndex(hover.p, lastFrame.current.players) : 0

  return (
    <div ref={wrap} className="relative h-full min-h-0 w-full overflow-hidden rounded-md bg-canvas">
      <canvas
        ref={canvas}
        role="img"
        aria-label={tx('replay.canvas_label')}
        style={{ width: size.w, height: size.h, cursor: hover ? 'pointer' : 'default' }}
        onPointerMove={(e) => setHover(pick(e))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const hit = pick(e as unknown as React.PointerEvent)
          onPlayerClick(hit ? `${hit.p.team}${hit.p.num}` : null)
        }}
      />
      {!lp.data.teams.players ? <span className="pointer-events-none absolute bottom-2 left-2 rounded-sm border border-dashed border-hair-strong bg-canvas px-2 py-1 text-xs text-fg-3">{tx('replay.no_positions_chip')}</span> : null}
      {hover ? (
        <div
          className="pointer-events-none absolute z-10 rounded-sm border border-hair-strong bg-s3 px-2 py-1 text-xs shadow-lg"
          style={{ left: Math.min(hover.x + 14, size.w - 150), top: Math.max(4, hover.y - 46) }}
        >
          <p className="font-medium text-fg-1">{playerLabel(hover.p.team, hover.p.num)}</p>
          <p className="font-mono tabular-nums text-fg-3">
            {(hover.p.speed * 3.6).toFixed(1)} km/h · {tx('replay.pressure_short')} {pressure.toFixed(2)}
          </p>
        </div>
      ) : null}
    </div>
  )
}
