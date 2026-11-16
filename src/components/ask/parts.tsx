import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as Collapsible from '@radix-ui/react-collapsible'
import { Activity, ArrowUp, CheckCheck, ChevronDown, CornerDownLeft, Crosshair, Footprints, Info, Loader2, Play, Repeat, Route } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import type { LoadedPack } from '@/api/packs'
import type { Turn } from '@/state/askStore'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { AiMarker, ParityIcon } from '@/components/ui/badges'
import { CitationChip, MomentCard } from '@/components/ui/moment'
import { Threshold } from '@/components/ui/threshold'
import { fillRefs, useWho } from '@/lib/names'
import type { Match, MetricId, ParityState } from '@/lib/types'
import { PROVIDER_NAME } from '@/lib/providers'

/*
 * Shared pieces of Ask Ponta, used by the full page (/ask) and by the panel inside a match.
 * One answer renderer, so both surfaces state limits, cite and verify the same way.
 */
export interface Prompt {
  q: string
  topic: string
  /** Metrics the answer depends on; the card shows the weakest parity state among them. */
  metrics: MetricId[]
}
export const P = {
  pressure: { q: 'Where did we lose the ball under high pressure in the second half?', topic: 'ask.topic_pressure', metrics: ['pressure_index'] },
  passing: { q: 'Show the progressive passes that were rated Optimal', topic: 'ask.topic_passing', metrics: ['pass_value', 'pass_alternatives'] },
  transitions: { q: 'Show the counter-attacks we conceded after losing the ball', topic: 'ask.topic_transitions', metrics: ['control_surface'] },
  offball: { q: 'Show high-value off-ball runs after the 70th minute', topic: 'ask.topic_offball', metrics: ['run_value'] },
  fatigue: { q: 'Which players looked fatigued after the 70th minute?', topic: 'ask.topic_load', metrics: ['fitness_linked'] },
  losses: { q: 'Show ball losses in the second half', topic: 'ask.topic_possession', metrics: [] },
  sprints: { q: 'Show sprint efforts in the second half', topic: 'ask.topic_load', metrics: ['high_intensity'] },
} satisfies Record<string, Prompt>
export const PROMPTS: Record<'optical' | 'events' | 'gps', Prompt[]> = {
  optical: [P.pressure, P.passing, P.transitions, P.offball, P.fatigue],
  events: [P.losses, P.passing, P.pressure, P.fatigue],
  gps: [P.sprints, P.losses, P.fatigue],
}

export const RANK: Record<ParityState, number> = { full: 0, degraded: 1, blocked: 2 }
export function weakest(states: ParityState[]): ParityState {
  return states.reduce<ParityState>((w, s) => (RANK[s] > RANK[w] ? s : w), 'full')
}

export const label = (m: Match) => `${m.home} v ${m.away}`
export const opponent = (m: Match) => `v ${m.home.startsWith('Harlow') ? m.away : m.home}`

export const TOPIC_ICON: Record<string, typeof Activity> = {
  'ask.topic_pressure': Crosshair,
  'ask.topic_passing': Route,
  'ask.topic_transitions': Repeat,
  'ask.topic_offball': Footprints,
  'ask.topic_load': Activity,
  'ask.topic_possession': Repeat,
}

/* ---------------- Composer ---------------- */
/** `compact` is the match panel: 13 px text, a lower box and a smaller send button. */
export function Composer({ onSend, disabled, big, compact, placeholder, initial, toolbar, autoFocus, above }: { onSend: (q: string) => void; disabled?: boolean; big?: boolean; compact?: boolean; placeholder: string; initial?: string; toolbar?: React.ReactNode; autoFocus?: boolean; above?: React.ReactNode }) {
  const [v, setV] = useState(initial ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)
  const inputId = useId()
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [v])
  const send = () => {
    const q = v.trim()
    if (!q || disabled) return
    onSend(q)
    setV('')
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
      // Reference composer: a thin blue-tinted edge that brightens on focus, 12 px padding.
      className={cn(
        'border border-[var(--composer-edge)] bg-s1 transition-colors focus-within:border-accent',
        big ? 'flex flex-col rounded-2xl p-3' : above ? 'grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 gap-y-1.5 rounded-2xl p-2 pl-3 [&>*:first-child]:col-span-2' : 'flex items-end gap-2 rounded-2xl p-2 pl-3',
      )}
    >
      {above}
      <label htmlFor={inputId} className="sr-only">
        {t('ask.input_label')}
      </label>
      <textarea
        id={inputId}
        ref={ref}
        rows={big ? 3 : 1}
        value={v}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
        }}
        className={cn('no-focus-ring max-h-40 w-full resize-none bg-transparent px-2 py-1 text-fg-1 outline-none placeholder:text-fg-4 focus-visible:outline-none', big ? 'min-h-[72px] text-base' : compact ? 'min-h-[24px] flex-1 text-[13px] leading-5' : 'min-h-[28px] flex-1 text-base')}
      />
      {big ? (
        <div className="mt-2 flex items-center justify-between gap-3 px-1">
          {toolbar ?? (
            <span className="flex items-center gap-1.5 text-xs text-fg-4">
              <CornerDownLeft className="size-3" aria-hidden />
              {t('ask.hint_keys')}
            </span>
          )}
          <Button type="submit" variant="primary" size="icon" className="rounded-lg" disabled={!v.trim() || disabled} aria-label={t('ask.send')}>
            <ArrowUp className="size-4" aria-hidden />
          </Button>
        </div>
      ) : (
        <Button type="submit" variant="primary" size={compact ? 'icon-sm' : 'icon'} className="rounded-lg" disabled={!v.trim() || disabled} aria-label={t('ask.send')}>
          <ArrowUp className={compact ? 'size-3.5' : 'size-4'} aria-hidden />
        </Button>
      )}
    </form>
  )
}

/* ---------------- Answer ---------------- */
/** Body text in an answer: 14 px on the Ask page, 13 px in the match panel (`compact`). */
const bodyText = (compact?: boolean) => (compact ? 'text-[13px] leading-5' : 'text-sm')

const stateText: Record<ParityState | 'info', string> = { full: 'parity.full', degraded: 'parity.degraded', blocked: 'parity.blocked', info: 'ask.note' }

/**
 * What the answer did, as a collapsible step list (reference: agent task transparency).
 * Completed steps carry a double check; the data-check step opens by default when anything
 * limits the answer, so a limit is never hidden.
 */
export function AnswerSteps({ turn, match, total, verified, compact }: { turn: Turn; match?: Match; total: number; verified: number; compact?: boolean }) {
  const a = turn.answer!
  const limiting = a.statements.some((x) => x.state === 'degraded' || x.state === 'blocked')
  const statements = !limiting ? [{ state: 'full' as const, text: t('ask.all_full') }, ...a.statements] : a.statements
  const [open, setOpen] = useState(limiting)
  const verifying = turn.phase === 'verifying'
  const row = cn('flex items-center gap-3', compact ? 'py-1' : 'py-1.5', bodyText(compact))
  return (
    <section aria-label={t('ask.parity_statement')} className="flex flex-col">
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger className={cn(row, 'w-full text-left text-fg-2 hover:text-fg-1')}>
          <CheckCheck className="size-4 shrink-0 text-fg-3" aria-hidden />
          <span className="flex-1">{t('ask.step_read')}{match ? <span className="text-fg-4"> · {match.sources.map((x) => PROVIDER_NAME[x.provider]).join(' + ')}</span> : null}</span>
          <ChevronDown className={cn('size-4 shrink-0 text-fg-3 transition-transform', open && 'rotate-180')} aria-hidden />
        </Collapsible.Trigger>
        <Collapsible.Content>
          <ul className="mb-1.5 ml-[7px] flex flex-col gap-1.5 border-l border-hair py-1 pl-5">
            {statements.map((x, i) => (
              <li key={i} className={cn('flex items-start gap-2', bodyText(compact))}>
                {x.state === 'info' ? <Info className="mt-0.5 size-3.5 shrink-0 text-fg-3" aria-hidden /> : <ParityIcon state={x.state} size={13} className="mt-0.5 shrink-0" />}
                <span className="min-w-0 text-fg-3">
                  <span className={cn('mr-1.5 font-medium', x.state === 'blocked' ? 'text-parity-dim' : x.state === 'degraded' ? 'text-parity' : 'text-fg-2')}>{t(stateText[x.state])}.</span>
                  {x.text}
                </span>
              </li>
            ))}
          </ul>
        </Collapsible.Content>
      </Collapsible.Root>
      {total ? (
        <p className={cn(row, 'text-fg-2')}>
          <CheckCheck className="size-4 shrink-0 text-fg-3" aria-hidden />
          {t('ask.step_found', { n: total })}
        </p>
      ) : null}
      {total && (verifying || turn.phase === 'done') ? (
        <p className={cn(row, 'text-fg-2')} aria-live="polite">
          {verifying ? <Loader2 className="size-4 shrink-0 animate-spin-slow text-fg-3" aria-hidden /> : <CheckCheck className="size-4 shrink-0 text-fg-3" aria-hidden />}
          {verifying ? t('ask.verifying', { done: verified, total }) : t('ask.verified', { total })}
        </p>
      ) : null}
    </section>
  )
}


export function Refusal({ turn, onAsk, match, compact }: { turn: Turn; onAsk: (q: string) => void; match?: Match; compact?: boolean }) {
  const r = turn.answer!.refusal!
  return (
    <section aria-label={t('ask.refusal')} className="overflow-hidden rounded-xl border border-hair bg-s1">
      <div className="flex items-start gap-3 border-b border-hair px-4 py-3">
        <ParityIcon state="blocked" size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-fg-3">{t('ask.cannot_answer')}</p>
          <h3 className={cn('mt-0.5 font-semibold text-fg-1', compact ? 'text-sm' : 'text-md')}>{r.title}</h3>
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <ul className={cn('flex list-disc flex-col gap-1.5 pl-4 text-fg-1', bodyText(compact))}>
          {r.reasons.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        {r.blocked.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-fg-3">{t('ask.blocked_metrics')}</span>
            {r.blocked.map((m) => (
              <span key={m} className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-hair-strong px-2 text-xs text-parity-dim">
                <ParityIcon state="blocked" size={11} />
                {t(`metric.${m}`)}
              </span>
            ))}
          </div>
        ) : null}
        {r.alternatives.length ? (
          <div>
            <p className={cn('font-medium text-fg-1', bodyText(compact))}>{t('ask.instead')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {r.alternatives.map((a) => (
                <Button key={a.prompt} size="sm" className={compact ? 'h-auto min-h-7 py-1 text-left text-[13px] leading-5' : undefined} onClick={() => onAsk(a.prompt)}>
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {match ? (
          <p>
            <Link to={`/matches/${match.id}/parity`} className={cn('link', bodyText(compact))}>
              {t('ask.view_parity')}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  )
}

export function Progress({ turn, compact }: { turn: Turn; compact?: boolean }) {
  const lines: Record<string, string> = { reading: 'ask.phase_reading', finding: 'ask.phase_finding' }
  return (
    <p className={cn('flex items-center gap-2 text-fg-3', bodyText(compact))} role="status">
      <Loader2 className="size-3.5 animate-spin-slow" aria-hidden />
      {t(lines[turn.phase] ?? 'ask.phase_finding')}
    </p>
  )
}

/**
 * One answer. `compact` is the match panel (about 420 px): the moments become a numbered list of
 * citation chips instead of a grid of pitch thumbnails, and the type steps down one size.
 */
export function AnswerView({ turn, match, lp, onAsk, compact }: { turn: Turn; match?: Match; lp?: LoadedPack; onAsk: (q: string) => void; compact?: boolean }) {
  const nav = useNavigate()
  const who = useWho()
  const a = turn.answer
  if (turn.phase === 'reading' || turn.phase === 'finding' || !a) return <Progress turn={turn} compact={compact} />
  if (a.kind === 'refusal') return <Refusal turn={turn} onAsk={onAsk} match={match} compact={compact} />
  const words = a.summary.split(/\s+/)
  // Summaries carry player tokens ({home_5}); the client shows names or codes.
  const shown = fillRefs(turn.phase === 'streaming' ? words.slice(0, turn.words).join(' ') : a.summary, who)
  const total = a.playlist.length
  const verified = turn.phase === 'verifying' ? turn.verified : total
  const showList = (turn.phase === 'verifying' || turn.phase === 'done') && total > 0
  const showAfter = turn.phase === 'done'
  const events = a.playlist.map((id) => lp?.byId.get(id)).filter(Boolean)
  return (
    <div className="flex flex-col gap-4">
      <AnswerSteps turn={turn} match={match} total={total} verified={verified} compact={compact} />
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <AiMarker />
        </div>
        <p className={cn('max-w-[70ch] text-fg-1', compact ? 'text-[13px] leading-5' : 'text-base leading-6')}>
          {shown}
          {turn.phase === 'streaming' ? <span aria-hidden className="ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] bg-fg-1" style={{ animation: 'caret 1s steps(1) infinite' }} /> : null}
        </p>
      </div>

      {turn.phase === 'verifying' || showList ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <div className={cn('flex items-center gap-2', bodyText(compact))}>
            <span className="font-medium text-fg-2">{t('ask.playlist')}</span>
            {showAfter && events[0] ? (
              <Button size="sm" variant="secondary" className="ml-auto" onClick={() => nav(`/matches/${a.matchId}/replay?event=${events[0]!.id}`)}>
                <Play className="size-3 fill-current" aria-hidden />
                {t('ask.play_all')}
              </Button>
            ) : null}
          </div>
          {compact ? (
            <ol className="flex flex-col gap-1.5" aria-label={t('ask.playlist')}>
              {(turn.phase === 'done' || turn.verified >= total ? events : a.playlist.map(() => null)).map((e, i) =>
                e ? (
                  <li key={e.id} className="anim-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <CitationChip event={e} matchId={a.matchId} engine={lp?.engine} index={i + 1} />
                  </li>
                ) : (
                  <li key={i} aria-hidden className={cn('transition-opacity', i < verified ? 'opacity-100' : 'opacity-40')}>
                    <Skeleton className="h-[22px] w-[260px]" />
                  </li>
                ),
              )}
            </ol>
          ) : turn.phase === 'done' || turn.verified >= total ? (
            <div className="grid grid-cols-3 gap-4" aria-label={t('ask.playlist')} role="list">
              {events.map((e, i) => (
                <div key={e!.id} role="listitem" className="anim-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <MomentCard event={e!} matchId={a.matchId} engine={lp?.engine} fluid />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4" aria-hidden>
              {a.playlist.map((id, i) => (
                <div key={id} className={cn('flex flex-col gap-1.5 transition-opacity', i < verified ? 'opacity-100' : 'opacity-40')}>
                  <Skeleton className="aspect-[111/74] w-full" />
                  <Skeleton className="h-[22px] w-[210px]" />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {showAfter && a.kind === 'empty' ? <p className={cn('text-fg-3', bodyText(compact))}>{t('ask.empty_hint')}</p> : null}

      {showAfter ? (
        <div className="flex flex-col gap-3 anim-fade-up">
          {a.thresholds.length ? (
            <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', bodyText(compact))}>
              <span className="text-xs font-medium text-fg-4">{t('ask.thresholds')}</span>
              {a.thresholds.map((id) => (
                <Threshold key={id} id={id} />
              ))}
            </div>
          ) : null}
          <p className="flex max-w-[68ch] items-start gap-2 text-xs text-fg-3">
            <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
            {t('ask.no_numbers')}
          </p>
          {a.followUps.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-fg-3">{t('ask.follow_ups')}</span>
              {a.followUps.map((f) => (
                <button key={f} type="button" onClick={() => onAsk(f)} className={cn('rounded-md border border-hair-strong bg-s1 px-2.5 py-1 text-left text-fg-1 hover:bg-s2', bodyText(compact))}>
                  {f}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
