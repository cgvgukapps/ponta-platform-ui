import { useEffect, useMemo, useRef, useState } from 'react'
import type { LoadedPack } from '@/api/packs'
import type { MatchEvent } from '@/lib/types'
import { fmtClock } from '@/lib/format'
import { t } from '@/i18n'
import { confFrac } from '@/components/ui/badges'
import { useClock, type PlaybackStore } from './playback'

const PAD = 10
const RULER = 16
const TICKS = 30
const CONF = 9
export const TIMELINE_H = RULER + TICKS + CONF + 10

interface Props {
  lp: LoadedPack
  store: PlaybackStore
  notable: MatchEvent[]
  cited: string[]
  selectedId: string | null
  onSelect: (e: MatchEvent) => void
}

export function Timeline({ lp, store, notable, cited, selectedId, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(900)
  const [hoverT, setHoverT] = useState<number | null>(null)
  const dragging = useRef(false)
  const now = useClock(store, 1 / 25)
  const { duration, htAt } = store

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const X = (s: number) => PAD + (s / duration) * (w - PAD * 2)
  const T = (x: number) => Math.max(0, Math.min(duration, ((x - PAD) / (w - PAD * 2)) * duration))

  const confCells = useMemo(() => {
    const out: { s: number; c: number }[] = []
    for (let s = 0; s < duration; s += 30) out.push({ s, c: lp.engine.confidenceAt(s + 15) })
    return out
  }, [lp, duration])
  const hist = useMemo(() => {
    const bins = new Array(Math.ceil(duration / 60)).fill(0)
    for (const e of lp.events) bins[Math.min(bins.length - 1, Math.floor(e.t / 60))]++
    return bins
  }, [lp, duration])
  const hmax = Math.max(...hist, 1)
  const citedEvents = cited.map((id) => lp.byId.get(id)).filter(Boolean) as MatchEvent[]

  const seekFrom = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    store.seek(T(clientX - r.left))
  }
  const rulerMarks: number[] = []
  for (let m = 0; m * 60 <= duration; m += 15) rulerMarks.push(m * 60)

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={t('replay.timeline')}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(now)}
      aria-valuetext={fmtClock(now)}
      className="relative select-none rounded-lg bg-s1 outline-none touch-none"
      style={{ height: TIMELINE_H }}
      onPointerDown={(e) => {
        dragging.current = true
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        seekFrom(e.clientX)
      }}
      onPointerMove={(e) => {
        const r = ref.current!.getBoundingClientRect()
        setHoverT(T(e.clientX - r.left))
        if (dragging.current) seekFrom(e.clientX)
      }}
      onPointerUp={(e) => {
        dragging.current = false
        ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      }}
      onPointerLeave={() => setHoverT(null)}
    >
      <svg width={w} height={TIMELINE_H} className="block" aria-hidden>

        {/* ruler */}
        {rulerMarks.map((s) => (
          <g key={s}>
            <line x1={X(s)} x2={X(s)} y1={RULER - 5} y2={RULER} stroke="var(--fg-4)" />
            <text x={X(s) + 3} y={RULER - 5} fill="var(--fg-3)" fontSize="10" fontFamily="var(--font-mono)" className="tabular-nums">
              {s / 60}&apos;
            </text>
          </g>
        ))}

        {/* period background */}
        <rect x={X(0)} y={RULER} width={X(htAt) - X(0) - 1} height={TICKS} fill="var(--surface-2)" />
        <rect x={X(htAt) + 1} y={RULER} width={X(duration) - X(htAt) - 1} height={TICKS} fill="var(--surface-2)" />
        <text x={X(htAt) + 4} y={RULER + 9} fill="var(--fg-3)" fontSize="9" fontFamily="var(--font-mono)">
          HT
        </text>

        {/* density */}
        {hist.map((c, i) => {
          const hgt = (c / hmax) * (TICKS - 8)
          const x0 = X(i * 60)
          const x1 = X(Math.min(duration, (i + 1) * 60))
          return <rect key={i} x={x0 + 0.5} y={RULER + TICKS - hgt} width={Math.max(1, x1 - x0 - 1)} height={hgt} fill="var(--fg-4)" opacity="0.22" />
        })}

        {/* notable ticks */}
        {notable.map((e) => (
          <line key={e.id} x1={X(e.t)} x2={X(e.t)} y1={RULER + 3} y2={RULER + TICKS - 3} stroke={e.team === 'h' ? 'var(--team-home)' : 'var(--team-away)'} strokeWidth={e.id === selectedId ? 2 : 1} opacity={e.id === selectedId ? 1 : 0.85} />
        ))}

        {/* confidence strip */}
        <g transform={`translate(0 ${RULER + TICKS + 4})`}>
          <rect x={PAD} y={0} width={w - PAD * 2} height={CONF} fill="none" stroke="var(--hairline-strong)" />
          {confCells.map((c) => {
            const x0 = X(c.s)
            const x1 = X(Math.min(duration, c.s + 30))
            const hgt = Math.max(1.5, (CONF - 2) * confFrac(c.c))
            return <rect key={c.s} x={x0} y={CONF - 1 - hgt} width={Math.max(1, x1 - x0 - 0.5)} height={hgt} fill="var(--conf-ink)" opacity={0.75} />
          })}
        </g>

        {/* citation markers */}
        {citedEvents.map((e, i) => (
          <g key={e.id} transform={`translate(${X(e.t)} ${RULER + 2})`} className="cursor-pointer" onPointerDown={(ev) => ev.stopPropagation()} onClick={() => onSelect(e)}>
            <title>{`${i + 1}. ${e.id} · ${fmtClock(e.t)}`}</title>
            <path d="M0 -1 L5 4 L0 9 L-5 4Z" fill={selectedId === e.id ? 'var(--highlight)' : 'var(--canvas)'} stroke="var(--highlight)" strokeWidth="1.5" />
          </g>
        ))}

        {/* selected bracket */}
        {selectedId && lp.byId.get(selectedId) ? (
          <rect x={X(lp.byId.get(selectedId)!.t) - 4} y={RULER} width={8} height={TICKS} fill="none" stroke="var(--highlight)" strokeWidth="1.5" rx="1" />
        ) : null}

        {/* hover */}
        {hoverT !== null ? <line x1={X(hoverT)} x2={X(hoverT)} y1={RULER} y2={TIMELINE_H - 4} stroke="var(--fg-3)" strokeDasharray="2 2" /> : null}

        {/* playhead */}
        <g>
          <line x1={X(now)} x2={X(now)} y1={RULER - 2} y2={TIMELINE_H - 2} stroke="var(--fg-1)" strokeWidth="2" />
          <path d={`M${X(now) - 5} ${RULER - 4} h10 l-5 6z`} fill="var(--fg-1)" />
        </g>
      </svg>
      {hoverT !== null ? (
        <span className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-sm bg-s3 px-1.5 text-2xs font-mono tabular-nums text-fg-1" style={{ left: X(hoverT) }}>
          {fmtClock(hoverT)}
        </span>
      ) : null}
    </div>
  )
}
