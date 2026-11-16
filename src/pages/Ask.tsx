import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Activity, Info, MessageSquarePlus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { useApp } from '@/state/app'
import { useAsync } from '@/lib/useAsync'
import { listMatches, parityFor } from '@/api'
import { loadPack } from '@/api/packs'
import { ask, ensureLoaded, seedThreads, useAskStore, type Thread } from '@/state/askStore'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/form'
import { EmptyState, Skeleton } from '@/components/ui/feedback'
import { ParityIcon, ParitySummary, TierBadge } from '@/components/ui/badges'
import { fmtDate, fmtRelative } from '@/lib/format'
import { FAMILIES, type Match, type MetricId } from '@/lib/types'
import { fillRefs, makeWho, WhoProvider } from '@/lib/names'
import { AnswerView, Composer, PROMPTS, TOPIC_ICON, label, opponent, weakest } from '@/components/ask/parts'

/* ---------------- Sidebar ---------------- */
function Sidebar({ threads, activeId, matches }: { threads: Thread[]; activeId: string | null; matches: Match[] }) {
  const nav = useNavigate()
  const { nameMode } = useApp()
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
                  <span className={cn('line-clamp-2 text-sm leading-5', active ? 'text-fg-1' : 'text-fg-2')}>{fillRefs(th.title, makeWho(m, nameMode))}</span>
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


/* ---------------- Page ---------------- */
export function AskPage() {
  const { threadId } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { orgId, nameMode } = useApp()
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
              <h1 className="min-w-0 truncate text-base font-semibold text-fg-1">{fillRefs(thread.title, makeWho(ctxMatch, nameMode))}</h1>
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
                    <WhoProvider key={turn.id} match={m}>
                    <article aria-label={fillRefs(turn.question, makeWho(m, nameMode))} className={cn('flex flex-col gap-5', i > 0 && 'mt-10 border-t border-hair pt-10')}>
                      <div className="flex justify-end">
                        <div className="max-w-[78%] rounded-2xl rounded-tr-md bg-s2 px-4 py-2.5">
                          <p className="sr-only">{t('ask.you_asked')}</p>
                          <p className="text-base leading-6 text-fg-1">{fillRefs(turn.question, makeWho(m, nameMode))}</p>
                        </div>
                      </div>
                      <AnswerView turn={turn} match={m} lp={packQ.data && packQ.data.match.id === turn.matchId ? packQ.data : undefined} onAsk={send} />
                    </article>
                    </WhoProvider>
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
