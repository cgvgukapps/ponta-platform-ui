import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import * as Collapsible from '@radix-ui/react-collapsible'
import { Activity, ArrowUp, Check, CheckCheck, ChevronDown, Crosshair, Footprints, Info, Loader2, MessageSquarePlus, Play, Repeat, Route, CornerDownLeft } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { useApp } from '@/state/app'
import { useAsync } from '@/lib/useAsync'
import { listMatches, parityFor } from '@/api'
import { loadPack, type LoadedPack } from '@/api/packs'
import { ask, ensureLoaded, seedThreads, useAskStore, type Thread, type Turn } from '@/state/askStore'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/form'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { AiMarker, ParityIcon, ParityStrip, ParitySummary, TierBadge } from '@/components/ui/badges'
import { MomentCard } from '@/components/ui/moment'
import { Threshold } from '@/components/ui/threshold'
import { fmtDate, fmtRelative } from '@/lib/format'
import { FAMILIES, type Match, type MetricId, type ParityState } from '@/lib/types'
import { PROVIDER_NAME } from '@/lib/providers'

interface Prompt {
  q: string
  topic: string
  /** Metrics the answer depends on; the card shows the weakest parity state among them. */
  metrics: MetricId[]
}
const P = {
  pressure: { q: 'Where did we lose the ball under high pressure in the second half?', topic: 'ask.topic_pressure', metrics: ['pressure_index'] },
  passing: { q: 'Show the progressive passes that were rated Optimal', topic: 'ask.topic_passing', metrics: ['pass_value', 'pass_alternatives'] },
  transitions: { q: 'Show the counter-attacks we conceded after losing the ball', topic: 'ask.topic_transitions', metrics: ['control_surface'] },
  offball: { q: 'Show high-value off-ball runs after the 70th minute', topic: 'ask.topic_offball', metrics: ['run_value'] },
  fatigue: { q: 'Which players looked fatigued after the 70th minute?', topic: 'ask.topic_load', metrics: ['fitness_linked'] },
  losses: { q: 'Show ball losses in the second half', topic: 'ask.topic_possession', metrics: [] },
  sprints: { q: 'Show sprint efforts in the second half', topic: 'ask.topic_load', metrics: ['high_intensity'] },
} satisfies Record<string, Prompt>
const PROMPTS: Record<'optical' | 'events' | 'gps', Prompt[]> = {
  optical: [P.pressure, P.passing, P.transitions, P.offball, P.fatigue],
  events: [P.losses, P.passing, P.pressure, P.fatigue],
  gps: [P.sprints, P.losses, P.fatigue],
}

const RANK: Record<ParityState, number> = { full: 0, degraded: 1, blocked: 2 }
function weakest(states: ParityState[]): ParityState {
  return states.reduce<ParityState>((w, s) => (RANK[s] > RANK[w] ? s : w), 'full')
}

const label = (m: Match) => `${m.home} v ${m.away}`
const opponent = (m: Match) => `v ${m.home.startsWith('Harlow') ? m.away : m.home}`

/* ---------------- Sidebar ---------------- */
function Sidebar({ threads, activeId, matches }: { threads: Thread[]; activeId: string | null; matches: Match[] }) {
  const nav = useNavigate()
  return (
    <aside aria-label={t('ask.threads')} className="flex w-[272px] shrink-0 flex-col border-r border-hair bg-s1">
      <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-hair px-4">
        <h2 className="text-sm font-semibold text-fg-1">{t('ask.threads')}</h2>
        <Button size="sm" variant="secondary" onClick={() => nav('/ask')}>
          <MessageSquarePlus className="size-3.5" aria-hidden />
          {t('ask.new_thread')}
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto p-2" aria-label={t('ask.threads')}>
        {threads.length === 0 ? <p className="px-2 py-3 text-sm text-fg-3">{t('ask.no_threads')}</p> : null}
        <ul className="flex flex-col gap-0.5">
          {threads.map((th) => {
            const m = matches.find((x) => x.id === th.matchId)
            const active = th.id === activeId
            return (
              <li key={th.id}>
                <Link to={`/ask/${th.id}`} aria-current={active ? 'page' : undefined} className={cn('block rounded-md px-3 py-2 transition-colors duration-[var(--dur-fast)]', active ? 'bg-accent-tint shadow-[inset_0_-2px_0_var(--accent)]' : 'hover:bg-s2')}>
                  <span className={cn('line-clamp-2 text-sm leading-5', active ? 'text-fg-1' : 'text-fg-2')}>{th.title}</span>
                  <span className="mt-1 flex items-center gap-1.5 text-xs text-fg-4">
                    <span className="truncate">{m ? opponent(m) : th.matchId}</span>
                    <span aria-hidden>·</span>
                    <span className="shrink-0 whitespace-nowrap">{fmtRelative(th.updatedAt)}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

const TOPIC_ICON: Record<string, typeof Activity> = {
  'ask.topic_pressure': Crosshair,
  'ask.topic_passing': Route,
  'ask.topic_transitions': Repeat,
  'ask.topic_offball': Footprints,
  'ask.topic_load': Activity,
  'ask.topic_possession': Repeat,
}

/* ---------------- Composer ---------------- */
function Composer({ onSend, disabled, big, placeholder, initial, toolbar }: { onSend: (q: string) => void; disabled?: boolean; big?: boolean; placeholder: string; initial?: string; toolbar?: React.ReactNode }) {
  const [v, setV] = useState(initial ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)
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
        big ? 'flex flex-col rounded-2xl p-3' : 'flex items-end gap-2 rounded-2xl p-2 pl-3',
      )}
    >
      <label htmlFor="ask-input" className="sr-only">
        {t('ask.input_label')}
      </label>
      <textarea
        id="ask-input"
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
        className={cn('no-focus-ring max-h-40 w-full resize-none bg-transparent px-2 py-1 text-fg-1 outline-none placeholder:text-fg-4 focus-visible:outline-none', big ? 'min-h-[72px] text-base' : 'min-h-[28px] flex-1 text-base')}
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
        <Button type="submit" variant="primary" size="icon" className="rounded-lg" disabled={!v.trim() || disabled} aria-label={t('ask.send')}>
          <ArrowUp className="size-4" aria-hidden />
        </Button>
      )}
    </form>
  )
}

/* ---------------- Answer ---------------- */
const stateText: Record<ParityState | 'info', string> = { full: 'parity.full', degraded: 'parity.degraded', blocked: 'parity.blocked', info: 'ask.note' }

/**
 * What the answer did, as a collapsible step list (reference: agent task transparency).
 * Completed steps carry a double check; the data-check step opens by default when anything
 * limits the answer, so a limit is never hidden.
 */
function AnswerSteps({ turn, match, total, verified }: { turn: Turn; match?: Match; total: number; verified: number }) {
  const a = turn.answer!
  const limiting = a.statements.some((x) => x.state === 'degraded' || x.state === 'blocked')
  const statements = !limiting ? [{ state: 'full' as const, text: t('ask.all_full') }, ...a.statements] : a.statements
  const [open, setOpen] = useState(limiting)
  const verifying = turn.phase === 'verifying'
  const row = 'flex items-center gap-3 py-1.5 text-sm'
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
              <li key={i} className="flex items-start gap-2 text-sm">
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

function ParityStatement({ turn, match }: { turn: Turn; match?: Match }) {
  const a = turn.answer!
  const limiting = a.statements.some((s) => s.state === 'degraded' || s.state === 'blocked')
  const statements = a.kind === 'answer' && !limiting ? [{ state: 'full' as const, text: t('ask.all_full') }, ...a.statements] : a.statements
  if (!statements.length) return null
  return (
    <section aria-label={t('ask.parity_statement')} className="rounded-xl border border-hair bg-s1">
      <div className="flex flex-wrap items-center gap-2 border-b border-hair px-3 py-2">
        <span className="text-xs font-medium text-fg-4">{t('ask.data_check')}</span>
        {match ? <TierBadge tier={match.tier} status={match.tierStatus} /> : null}
        {match ? <span className="text-xs text-fg-3">{match.sources.map((s) => PROVIDER_NAME[s.provider]).join(' + ')}</span> : null}
      </div>
      <ul className="flex flex-col divide-y divide-[var(--hairline)]">
        {statements.map((s, i) => (
          <li key={i} className="flex items-start gap-2.5 px-3 py-2 text-sm">
            {s.state === 'info' ? <Info className="mt-0.5 size-3.5 shrink-0 text-fg-3" aria-hidden /> : <ParityIcon state={s.state} size={14} className="mt-0.5 shrink-0" />}
            <span className="min-w-0">
              <span className={cn('mr-1.5 font-medium', s.state === 'blocked' ? 'text-parity-dim' : s.state === 'degraded' ? 'text-parity' : 'text-fg-2')}>{t(stateText[s.state])}.</span>
              <span className="text-fg-1">{s.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Refusal({ turn, onAsk, match }: { turn: Turn; onAsk: (q: string) => void; match?: Match }) {
  const r = turn.answer!.refusal!
  return (
    <section aria-label={t('ask.refusal')} className="overflow-hidden rounded-xl border border-hair bg-s1">
      <div className="flex items-start gap-3 border-b border-hair px-4 py-3">
        <ParityIcon state="blocked" size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-fg-3">{t('ask.cannot_answer')}</p>
          <h3 className="mt-0.5 text-md font-semibold text-fg-1">{r.title}</h3>
        </div>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm text-fg-1">
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
            <p className="text-sm font-medium text-fg-1">{t('ask.instead')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {r.alternatives.map((a) => (
                <Button key={a.prompt} size="sm" onClick={() => onAsk(a.prompt)}>
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
        {match ? (
          <p>
            <Link to={`/matches/${match.id}/parity`} className="link text-sm">
              {t('ask.view_parity')}
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  )
}

function Progress({ turn }: { turn: Turn }) {
  const lines: Record<string, string> = { reading: 'ask.phase_reading', finding: 'ask.phase_finding' }
  return (
    <p className="flex items-center gap-2 text-sm text-fg-3" role="status">
      <Loader2 className="size-3.5 animate-spin-slow" aria-hidden />
      {t(lines[turn.phase] ?? 'ask.phase_finding')}
    </p>
  )
}

function AnswerView({ turn, match, lp, onAsk }: { turn: Turn; match?: Match; lp?: LoadedPack; onAsk: (q: string) => void }) {
  const nav = useNavigate()
  const a = turn.answer
  if (turn.phase === 'reading' || turn.phase === 'finding' || !a) return <Progress turn={turn} />
  if (a.kind === 'refusal') return <Refusal turn={turn} onAsk={onAsk} match={match} />
  const words = a.summary.split(/\s+/)
  const shown = turn.phase === 'streaming' ? words.slice(0, turn.words).join(' ') : a.summary
  const total = a.playlist.length
  const verified = turn.phase === 'verifying' ? turn.verified : total
  const showList = (turn.phase === 'verifying' || turn.phase === 'done') && total > 0
  const showAfter = turn.phase === 'done'
  const events = a.playlist.map((id) => lp?.byId.get(id)).filter(Boolean)
  return (
    <div className="flex flex-col gap-4">
      <AnswerSteps turn={turn} match={match} total={total} verified={verified} />
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <AiMarker />
        </div>
        <p className="max-w-[70ch] text-base leading-6 text-fg-1">
          {shown}
          {turn.phase === 'streaming' ? <span aria-hidden className="ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] bg-fg-1" style={{ animation: 'caret 1s steps(1) infinite' }} /> : null}
        </p>
      </div>

      {turn.phase === 'verifying' || showList ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-sm font-medium text-fg-2">{t('ask.playlist')}</span>
            {showAfter && events[0] ? (
              <Button size="sm" variant="secondary" className="ml-auto" onClick={() => nav(`/matches/${a.matchId}/replay?event=${events[0]!.id}`)}>
                <Play className="size-3 fill-current" aria-hidden />
                {t('ask.play_all')}
              </Button>
            ) : null}
          </div>
          {turn.phase === 'done' || turn.verified >= total ? (
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

      {showAfter && a.kind === 'empty' ? <p className="text-sm text-fg-3">{t('ask.empty_hint')}</p> : null}

      {showAfter ? (
        <div className="flex flex-col gap-3 anim-fade-up">
          {a.thresholds.length ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
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
                <button key={f} type="button" onClick={() => onAsk(f)} className="rounded-md border border-hair-strong bg-s1 px-2.5 py-1 text-left text-sm text-fg-1 hover:bg-s2">
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

/* ---------------- Page ---------------- */
export function AskPage() {
  const { threadId } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { orgId } = useApp()
  const store = useAskStore()
  const matchesQ = useAsync(() => listMatches(orgId), [orgId])
  const matches = useMemo(() => (matchesQ.data ?? []).filter((m) => m.status === 'ready' && m.pack), [matchesQ.data])
  const thread = threadId ? store.get(threadId) : undefined
  const scroller = useRef<HTMLDivElement>(null)
  const qParam = params.get('q')

  useEffect(() => {
    void seedThreads()
  }, [])
  useEffect(() => {
    if (threadId) ensureLoaded(threadId)
  }, [threadId, store.threads.length])

  const [ctxId, setCtxId] = useState<string | null>(params.get('match'))
  const ctxMatch = matches.find((m) => m.id === (thread?.matchId ?? ctxId)) ?? matches.find((m) => m.id === 'm_0412') ?? matches[0]
  const packQ = useAsync(() => (ctxMatch ? loadPack(ctxMatch.id) : Promise.resolve(null)), [ctxMatch?.id])

  const send = (q: string) => {
    if (!ctxMatch) return
    const id = ask(thread?.id ?? null, ctxMatch.id, q)
    if (id !== threadId) nav(`/ask/${id}`)
  }

  // A question handed over from the brief opens as a prefilled prompt, not an auto-sent one.
  const [prefill] = useState(qParam)

  const lastTurn = thread?.turns[thread.turns.length - 1]
  useEffect(() => {
    // Follow the answer while it is being written; once it is complete, keep the question and
    // the parity statement in view instead of leaving the reader at the foot of a long answer.
    const el = scroller.current
    if (!el) return
    if (lastTurn && lastTurn.phase !== 'done') el.scrollTo({ top: el.scrollHeight })
    else {
      const articles = el.querySelectorAll('article')
      const last = articles[articles.length - 1] as HTMLElement | undefined
      const top = last ? last.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 24 : 0
      el.scrollTo({ top: Math.max(0, top) })
    }
  }, [thread?.id, thread?.turns.length, lastTurn?.phase, lastTurn?.verified])

  const busy = !!lastTurn && lastTurn.phase !== 'done'
  const empty = matchesQ.data && matches.length === 0
  const prompts = ctxMatch?.pack ? PROMPTS[ctxMatch.pack] : PROMPTS.optical
  const ctxStates = ctxMatch ? FAMILIES.flatMap((f) => f.metrics).map((id: MetricId) => parityFor(ctxMatch).metrics[id].state) : []

  return (
    <div className="flex h-full min-h-[560px]">
      <Sidebar threads={store.threads} activeId={threadId ?? null} matches={matchesQ.data ?? []} />
      <div className="flex min-w-0 flex-1 flex-col">
        {empty ? (
          <EmptyState title={t('ask.empty_org_title')} body={t('ask.empty_org_body')} actions={<Link to="/matches/new" className="link text-sm">{t('lib.add_data')}</Link>} />
        ) : !thread ? (
          <div className="relative min-h-0 flex-1 overflow-y-auto px-8 py-12">
            {/* Reference: a soft horizon glow behind the empty state, in Ponta blue. */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]" style={{ background: 'radial-gradient(120% 70% at 50% 115%, var(--glow), transparent 60%)' }} />
            <div className="relative mx-auto flex min-h-full w-full max-w-[760px] flex-col justify-center">
              <h1 className="text-center font-serif text-[44px] font-normal leading-[52px] tracking-tight text-fg-1">{t('ask.hero')}</h1>
              <p className="mx-auto mt-3 max-w-[56ch] text-center text-base text-fg-3">{t('ask.intro')}</p>

              <div className="mt-8">
                <Composer
                  big
                  onSend={send}
                  initial={prefill ?? undefined}
                  placeholder={t('ask.placeholder')}
                  disabled={!ctxMatch}
                  toolbar={
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-xs text-fg-4">{t('ask.about')}</span>
                      {matches.length ? (
                        <Select size="sm" aria-label={t('ask.about')} value={ctxMatch?.id ?? ''} onValueChange={setCtxId} options={matches.map((m) => ({ value: m.id, label: `${label(m)} · ${fmtDate(m.date)}` }))} className="w-[360px] max-w-full whitespace-nowrap [&>span]:truncate" />
                      ) : (
                        <Skeleton className="h-7 w-48" />
                      )}
                      {ctxMatch ? (
                        <Link to={`/matches/${ctxMatch.id}/parity`} className="shrink-0" title={t('ask.view_parity')}>
                          <ParitySummary summary={parityFor(ctxMatch).summary} states={ctxStates} compact />
                        </Link>
                      ) : null}
                    </span>
                  }
                />
                {prefill ? <p className="mt-2 text-xs text-fg-3">{t('ask.prefill')}</p> : null}
              </div>

              {/* Suggestion chips (reference): icon and topic; the full question is the tooltip. */}
              <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label={t('ask.try')}>
                {prompts.map((p) => {
                  const state = ctxMatch && p.metrics.length ? weakest(p.metrics.map((id) => parityFor(ctxMatch).metrics[id].state)) : null
                  const Icon = TOPIC_ICON[p.topic] ?? Activity
                  return (
                    <li key={p.q}>
                      <button
                        type="button"
                        disabled={!ctxMatch}
                        onClick={() => send(p.q)}
                        title={p.q}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-hair bg-s1 px-3 text-sm text-fg-2 transition-colors hover:bg-s2 hover:text-fg-1 disabled:opacity-50"
                      >
                        <Icon className="size-4 text-fg-3" aria-hidden />
                        <span className="sr-only">{p.q}. </span>
                        {t(p.topic)}
                        {state && state !== 'full' ? (
                          <span className={cn(state === 'blocked' ? 'text-parity-dim' : 'text-parity')} title={t(`ask.gate_${state}`)}>
                            <ParityIcon state={state} size={11} />
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>

              <p className="mx-auto mt-10 flex max-w-[66ch] items-start gap-2 text-center text-xs text-fg-3">
                <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
                {t('ask.rule')}
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-hair px-6">
              <h1 className="min-w-0 truncate text-base font-semibold text-fg-1">{thread.title}</h1>
              {ctxMatch ? (
                <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-fg-3">
                  <span className="hidden xl:inline">{label(ctxMatch)}</span>
                  <TierBadge tier={ctxMatch.tier} status={ctxMatch.tierStatus} />
                  <ParitySummary summary={parityFor(ctxMatch).summary} states={ctxStates} compact />
                  <Link to={`/matches/${ctxMatch.id}/parity`} className="link">
                    {t('ask.view_parity')}
                  </Link>
                </span>
              ) : null}
            </header>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-8 pb-6 pt-8">
              <div className="mx-auto flex max-w-[800px] flex-col">
                {thread.turns.map((turn, i) => {
                  const m = matches.find((x) => x.id === turn.matchId) ?? ctxMatch
                  return (
                    <article key={turn.id} aria-label={turn.question} className={cn('flex flex-col gap-5', i > 0 && 'mt-10 border-t border-hair pt-10')}>
                      <div className="flex justify-end">
                        <div className="max-w-[78%] rounded-2xl rounded-tr-md bg-s2 px-4 py-2.5">
                          <p className="sr-only">{t('ask.you_asked')}</p>
                          <p className="text-base leading-6 text-fg-1">{turn.question}</p>
                        </div>
                      </div>
                      <AnswerView turn={turn} match={m} lp={packQ.data && packQ.data.match.id === turn.matchId ? packQ.data : undefined} onAsk={send} />
                    </article>
                  )
                })}
              </div>
            </div>
            <div className="shrink-0 bg-canvas px-8 pb-4 pt-2">
              <div className="mx-auto max-w-[800px]">
                <Composer onSend={send} disabled={busy || !ctxMatch} placeholder={t('ask.placeholder_followup')} />
                {ctxMatch ? (
                  <p className="mt-2 truncate text-center text-xs text-fg-4">
                    {label(ctxMatch)} · {t('ask.footer_note')}
                  </p>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
