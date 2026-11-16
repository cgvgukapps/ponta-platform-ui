import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import type { MatchEvent } from '@/lib/types'
import type { Engine, Frame } from '@/lib/engine'
import { PITCH_L, PITCH_W } from '@/lib/engine'
import { PITCH_PATHS } from '@/lib/pitch'
import { cn } from '@/lib/cn'
import { fmtClock } from '@/lib/format'
import { confLevel } from '@/lib/bands'
import { describeEvent, eventTypeLabel } from '@/lib/events'
import { t } from '@/i18n'
import { ConfidenceGlyph, DqBand, EstimateBand } from './badges'
import { HoverPreview, HoverPreviewTrigger, HoverPreviewContent } from './overlay'
import { useWho } from '@/lib/names'

/** Small SVG picture of a moment: pitch, the players at that instant, and the event vector. */
export function MomentThumb({ event, frame, className, labels = false }: { event: MatchEvent; frame?: Frame; className?: string; labels?: boolean }) {
  const [x0, y0] = event.from
  const [x1, y1] = event.to
  const moving = Math.hypot(x1 - x0, y1 - y0) > 1.5
  const who = useWho()
  return (
    <svg viewBox={`-3 -3 ${PITCH_L + 6} ${PITCH_W + 6}`} className={cn('block h-auto w-full rounded-sm', className)} role="img" aria-label={`${eventTypeLabel(event)}, ${describeEvent(event, who)}, ${fmtClock(event.t)}`}>
      <rect x="-3" y="-3" width={PITCH_L + 6} height={PITCH_W + 6} style={{ fill: 'var(--pitch)' }} />
      {PITCH_PATHS.map((d, i) => (
        <path key={i} d={d} fill="none" style={{ stroke: 'var(--pitch-line)' }} strokeWidth={0.5} />
      ))}
      {frame?.players.map((p) => (
        <circle key={p.team + p.num} cx={p.x} cy={p.y} r={1.9} style={{ fill: p.team === 'h' ? 'var(--team-home)' : 'var(--team-away)', stroke: 'var(--pitch)' }} strokeWidth={0.5} />
      ))}
      {moving ? (
        <>
          <line x1={x0} y1={y0} x2={x1} y2={y1} style={{ stroke: 'var(--highlight)' }} strokeWidth={event.type === 'run' || event.type === 'effort' ? 0.9 : 1.1} strokeDasharray={event.type === 'run' || event.type === 'effort' ? '2 1.6' : undefined} strokeLinecap="round" />
          <circle cx={x1} cy={y1} r={2.2} fill="none" style={{ stroke: 'var(--highlight)' }} strokeWidth={0.9} />
        </>
      ) : null}
      <circle cx={x0} cy={y0} r={2.6} style={{ fill: 'var(--highlight)', stroke: 'var(--pitch)' }} strokeWidth={0.6} />
      {labels ? null : null}
    </svg>
  )
}

function Preview({ event, engine }: { event: MatchEvent; engine?: Engine }) {
  const frame = engine && engine.opts.players ? engine.frame(event.t) : undefined
  const who = useWho()
  return (
    <div className="w-[260px]">
      <p className="mb-1.5 px-0.5 font-mono text-2xs tabular-nums text-fg-4">
        {event.id} · {t('chip.conf_full', { v: event.conf.toFixed(2) })}
      </p>
      <MomentThumb event={event} frame={frame} />
      <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
        <span className="min-w-0 text-xs font-medium text-fg-1">
          {eventTypeLabel(event)} <span className="text-fg-3">· {describeEvent(event, who)}</span>
        </span>
        {event.band ? <DqBand band={event.band} size="sm" /> : event.est ? <EstimateBand lo={event.est.lo} hi={event.est.hi} size="sm" /> : null}
      </div>
      <p className="mt-1 flex items-center gap-1.5 px-0.5 text-2xs text-fg-3">
        <Play className="size-3" aria-hidden />
        {t('chip.opens_replay', { t: fmtClock(event.t) })}
      </p>
    </div>
  )
}

/**
 * Citation chip. It leads with what a coach reads, the minute and the action
 * (`34:12 · Pass, Home 10 to Home 8 · 0.91`), and keeps the event id for audit: in the hover preview,
 * the accessible name and the printed brief. `compact` drops the action when a caption already says it.
 * Low-confidence citations use the confidence channel (dashed outline and a short level bar), never a hue.
 * The chip is a real link to the replay at that exact moment.
 */
export function CitationChip({ event, matchId, engine, index, className, variant = 'dark', compact }: { event: MatchEvent; matchId: string; engine?: Engine; index?: number; className?: string; variant?: 'dark' | 'print'; compact?: boolean }) {
  const low = confLevel(event.conf) === 'low'
  const who = useWho()
  const action = `${eventTypeLabel(event)}, ${describeEvent(event, who)}`
  const label = `${fmtClock(event.t)} · ${action} · ${t('chip.conf_full', { v: event.conf.toFixed(2) })} · ${event.id}`
  return (
    <HoverPreview openDelay={180} closeDelay={60}>
      <HoverPreviewTrigger asChild>
        <Link
          to={`/matches/${matchId}/replay?event=${event.id}`}
          aria-label={`${t('chip.open')} ${label}${low ? `, ${t('conf.low')}` : ''}`}
          className={cn(
            'group inline-flex h-[22px] max-w-full items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 text-[11.5px] leading-none tabular-nums transition-colors duration-[var(--dur-fast)]',
            low ? 'border-dashed border-[var(--conf-ink)] bg-s1 text-fg-1 hover:border-accent' : 'border-hair-strong bg-s2 text-fg-1 hover:border-accent hover:bg-s3',
            variant === 'print' && 'bg-white',
            className,
          )}
        >
          {index !== undefined ? <span className="text-fg-3">[{index}]</span> : <Play className="size-2.5 fill-current text-fg-3 group-hover:text-accent-text" aria-hidden />}
          <span className="font-mono">{fmtClock(event.t)}</span>
          {!compact ? (
            <>
              <span className="text-fg-4">·</span>
              <span className="min-w-0 truncate" title={action}>
                {action}
              </span>
            </>
          ) : null}
          <span className="text-fg-4">·</span>
          <span className="inline-flex shrink-0 items-center gap-1 font-mono" title={t('chip.conf_full', { v: event.conf.toFixed(2) })}>
            <ConfidenceGlyph value={event.conf} size={9} />
            <span>{event.conf.toFixed(2)}</span>
          </span>
          {variant === 'print' ? <span className="font-mono text-fg-4">{event.id}</span> : null}
        </Link>
      </HoverPreviewTrigger>
      <HoverPreviewContent>
        <Preview event={event} engine={engine} />
      </HoverPreviewContent>
    </HoverPreview>
  )
}

/** Playlist item: thumbnail of the moment above its citation chip. */
export function MomentCard({ event, matchId, engine, caption, fluid }: { event: MatchEvent; matchId: string; engine?: Engine; caption?: string; fluid?: boolean }) {
  const frame = engine && engine.opts.players ? engine.frame(event.t) : undefined
  const who = useWho()
  return (
    <div className={cn('flex shrink-0 flex-col gap-1.5', fluid ? 'w-full min-w-0' : 'w-[236px]')}>
      <Link to={`/matches/${matchId}/replay?event=${event.id}`} tabIndex={-1} aria-hidden className="overflow-hidden rounded-lg border border-transparent hover:border-accent">
        <MomentThumb event={event} frame={frame} />
      </Link>
      <CitationChip event={event} matchId={matchId} engine={engine} compact />
      <p className="line-clamp-2 text-xs text-fg-3">{caption ?? `${eventTypeLabel(event)} · ${describeEvent(event, who)}`}</p>
    </div>
  )
}
