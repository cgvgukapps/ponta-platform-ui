import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Crosshair, Info, Maximize2, MessageSquarePlus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { parityFor } from '@/api'
import { loadPack } from '@/api/packs'
import type { AskContext } from '@/api/ask'
import { useAsync } from '@/lib/useAsync'
import { ask, ensureLoaded, seedThreads, useAskStore } from '@/state/askStore'
import { Button } from '@/components/ui/button'
import { ParityIcon } from '@/components/ui/badges'
import { Tooltip } from '@/components/ui/overlay'
import { fmtClock, fmtRelative } from '@/lib/format'
import { eventTypeLabel } from '@/lib/events'
import { fillRefs, toRefs, useWho } from '@/lib/names'
import type { Match, MatchEvent } from '@/lib/types'
import { AnswerView, Composer, PROMPTS, TOPIC_ICON, weakest } from './parts'

/* ---------------------------------------------------------------------------------------------
 * Ask Ponta inside a match (brief v2, section 3, "Ask in the match"). The panel stays open while
 * the user moves between Data check, Brief and Replay, so a question can be checked against the
 * evidence without leaving it. On Data check and Brief it docks on the right; on Replay it is the
 * third tab of the side column. Threads are the same ones the full Ask page lists.
 * ------------------------------------------------------------------------------------------- */

interface Pending {
  text: string
  context?: AskContext
  nonce: number
}
interface AskPanelState {
  open: boolean
  setOpen: (v: boolean) => void
  threadId: string | null
  setThreadId: (id: string | null) => void
  pending: Pending | null
  /** Open the panel with a prefilled question (not sent) and, optionally, what it is about. */
  openWith: (text?: string, context?: AskContext) => void
  clearPending: () => void
}

const Ctx = createContext<AskPanelState | null>(null)

export function AskPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const nonce = useRef(0)
  const openWith = useCallback((text?: string, context?: AskContext) => {
    setPending({ text: text ?? '', context, nonce: ++nonce.current })
    setOpen(true)
  }, [])
  const clearPending = useCallback(() => setPending(null), [])
  const value = useMemo(() => ({ open, setOpen, threadId, setThreadId, pending, openWith, clearPending }), [open, threadId, pending, openWith, clearPending])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Null outside a match, so callers can fall back to the full Ask page. */
export const useAskPanel = () => useContext(Ctx)

/** "Pass at 34:12": the label on a context chip for one moment. */
export function momentLabel(e: MatchEvent) {
  return t('askp.ctx_moment', { what: eventTypeLabel(e), t: fmtClock(e.t) })
}

export function AskPanel({ match, variant, selected }: { match: Match; variant: 'docked' | 'embedded'; selected?: MatchEvent | null }) {
  const panel = useAskPanel()!
  const store = useAskStore()
  const who = useWho()
  const lpQ = useAsync(() => (match.pack ? loadPack(match.id) : Promise.resolve(null)), [match.id, match.pack])
  const thread = panel.threadId ? store.get(panel.threadId) : undefined
  const scroller = useRef<HTMLDivElement>(null)
  const [context, setContext] = useState<AskContext | undefined>(panel.pending?.context)

  useEffect(() => {
    void seedThreads()
  }, [])
  useEffect(() => {
    if (panel.threadId) ensureLoaded(panel.threadId)
  }, [panel.threadId, store.threads.length])
  // A new prefill brings its own context chip (or none).
  useEffect(() => {
    setContext(panel.pending?.context)
  }, [panel.pending?.nonce, panel.pending?.context])

  const lastTurn = thread?.turns[thread.turns.length - 1]
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    // Follow the answer while it is written; once complete, keep its question in view.
    if (lastTurn && lastTurn.phase !== 'done') el.scrollTo({ top: el.scrollHeight })
    else {
      const items = el.querySelectorAll('article')
      const last = items[items.length - 1] as HTMLElement | undefined
      const top = last ? last.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12 : 0
      el.scrollTo({ top: Math.max(0, top) })
    }
  }, [thread?.id, thread?.turns.length, lastTurn?.phase, lastTurn?.verified])

  const send = (q: string, ctx = context) => {
    // Names never leave the client: the stored question carries tokens, shown back as names or codes.
    const id = ask(thread?.id ?? null, match.id, toRefs(q, match), ctx)
    panel.setThreadId(id)
    panel.clearPending()
    setContext(undefined)
  }
  const busy = !!lastTurn && lastTurn.phase !== 'done'
  const report = parityFor(match)
  const prompts = match.pack ? PROMPTS[match.pack] : []
  const earlier = store.threads.filter((th) => th.matchId === match.id && th.id !== thread?.id).slice(0, 4)

  return (
    <section aria-label={t('askp.title')} className={cn('flex min-h-0 flex-col', variant === 'docked' ? 'h-full w-[420px] shrink-0 border-l border-hair bg-canvas' : 'h-full rounded-lg border border-hair bg-canvas')}>
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-hair pl-4 pr-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-fg-1">{thread ? fillRefs(thread.title, who) : t('askp.title')}</h2>
        </div>
        {thread ? (
          <>
            <Tooltip content={t('askp.new')}>
              <Button size="icon-sm" variant="ghost" aria-label={t('askp.new')} onClick={() => (panel.setThreadId(null), setContext(undefined))}>
                <MessageSquarePlus className="size-4" aria-hidden />
              </Button>
            </Tooltip>
            <Tooltip content={t('askp.open_full')}>
              <Link to={`/ask/${thread.id}`} aria-label={t('askp.open_full')} className="flex size-8 items-center justify-center rounded-md text-fg-3 hover:bg-s2 hover:text-fg-1">
                <Maximize2 className="size-4" aria-hidden />
              </Link>
            </Tooltip>
          </>
        ) : null}
        {variant === 'docked' ? (
          <Tooltip content={t('askp.close')}>
            <Button size="icon-sm" variant="ghost" aria-label={t('askp.close')} onClick={() => panel.setOpen(false)}>
              <X className="size-4" aria-hidden />
            </Button>
          </Tooltip>
        ) : null}
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!match.pack ? (
          <p className="text-sm text-fg-3">{t('askp.no_pack')}</p>
        ) : !thread ? (
          <div className="flex flex-col gap-5">
            <div>
              <p className="font-serif text-[22px] font-normal leading-7 tracking-tight text-fg-1">{t('askp.empty_title')}</p>
              <p className="mt-1 text-sm text-fg-3">{t('askp.empty_body')}</p>
            </div>

            {selected ? (
              <button
                type="button"
                onClick={() => send(t('askp.moment_q', { what: eventTypeLabel(selected).toLowerCase(), t: fmtClock(selected.t) }), { events: [selected.id], label: momentLabel(selected) })}
                className="flex items-center gap-3 rounded-xl border border-[var(--composer-edge)] bg-accent-tint px-3 py-2.5 text-left transition-colors hover:border-accent"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-accent">
                  <Crosshair className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-fg-1">{t('askp.about_selected')}</span>
                  <span className="block truncate text-xs text-fg-3">{momentLabel(selected)}</span>
                </span>
              </button>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-medium text-fg-4">{t('ask.try')}</p>
              <ul className="flex flex-col gap-1.5">
                {prompts.map((p) => {
                  const state = p.metrics.length ? weakest(p.metrics.map((id) => report.metrics[id].state)) : null
                  const Icon = TOPIC_ICON[p.topic] ?? Activity
                  return (
                    <li key={p.q}>
                      <button type="button" onClick={() => send(p.q, undefined)} className="flex w-full items-start gap-2.5 rounded-lg border border-hair bg-s1 px-3 py-2 text-left text-sm text-fg-2 transition-colors hover:bg-s2 hover:text-fg-1">
                        <Icon className="mt-0.5 size-4 shrink-0 text-fg-3" aria-hidden />
                        <span className="min-w-0 flex-1">{p.q}</span>
                        {state && state !== 'full' ? (
                          <span className={cn('mt-0.5 shrink-0', state === 'blocked' ? 'text-parity-dim' : 'text-parity')} title={t(`ask.gate_${state}`)}>
                            <ParityIcon state={state} size={12} />
                            <span className="sr-only">{t(`ask.gate_${state}`)}</span>
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {earlier.length ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-fg-4">{t('askp.earlier')}</p>
                <ul className="flex flex-col">
                  {earlier.map((th) => (
                    <li key={th.id}>
                      <button type="button" onClick={() => panel.setThreadId(th.id)} className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm text-fg-2 hover:bg-s2 hover:text-fg-1">
                        <span className="min-w-0 truncate">{fillRefs(th.title, who)}</span>
                        <span className="shrink-0 text-xs text-fg-4">{fmtRelative(th.updatedAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col">
            {thread.turns.map((turn, i) => (
              <article key={turn.id} aria-label={fillRefs(turn.question, who)} className={cn('flex flex-col gap-4', i > 0 && 'mt-6 border-t border-hair pt-6')}>
                <div className="flex flex-col items-end gap-1">
                  {turn.context ? <span className="text-xs text-fg-4">{t('askp.about', { what: turn.context.label })}</span> : null}
                  <div className="max-w-[88%] rounded-2xl rounded-tr-md bg-s2 px-3.5 py-2">
                    <p className="sr-only">{t('ask.you_asked')}</p>
                    <p className="text-[13px] leading-5 text-fg-1">{fillRefs(turn.question, who)}</p>
                  </div>
                </div>
                <AnswerView compact turn={turn} match={match} lp={lpQ.data ?? undefined} onAsk={(q) => send(q, undefined)} />
              </article>
            ))}
          </div>
        )}
      </div>

      {match.pack ? (
        <div className="shrink-0 px-3 pb-3 pt-2">
          <Composer
            key={panel.pending?.nonce ?? 0}
            initial={panel.pending?.text ? fillRefs(panel.pending.text, who) : undefined}
            autoFocus={!!panel.pending}
            compact
            onSend={(q) => send(q)}
            disabled={busy}
            placeholder={thread ? t('ask.placeholder_followup') : t('askp.placeholder')}
            above={
              context ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full bg-accent-tint pl-2.5 pr-1 text-xs text-fg-1">
                    <span className="truncate">{t('askp.about', { what: context.label })}</span>
                    <button type="button" onClick={() => setContext(undefined)} aria-label={t('askp.remove_context')} className="flex size-4 items-center justify-center rounded-full text-fg-3 hover:bg-s3 hover:text-fg-1">
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                </span>
              ) : undefined
            }
          />
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-center text-2xs text-fg-4">
            <Info className="size-3 shrink-0" aria-hidden />
            {t('ask.footer_note')}
          </p>
        </div>
      ) : null}
    </section>
  )
}
