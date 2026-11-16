import { useEffect, useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown, Copy, MessageSquarePlus, Play, TriangleAlert, Video } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import type { Band, MatchEvent } from '@/lib/types'
import { fmtClock } from '@/lib/format'
import { eventTypeLabel, describeEvent, periodName } from '@/lib/events'
import { BAND_THRESHOLDS, DQ_ELEVATED, DQ_MAX, HIGH_PRESSURE, confLevel } from '@/lib/bands'
import { Button } from '@/components/ui/button'
import { ConfidenceIndicator, DqBand, EstimateBand, TeamDot } from '@/components/ui/badges'
import { Threshold } from '@/components/ui/threshold'
import { Tooltip } from '@/components/ui/overlay'
import { useWho } from '@/lib/names'

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <dt className="text-fg-3">{label}</dt>
      <dd className="text-right text-fg-1">{children}</dd>
    </div>
  )
}

/** What happened, who did it, and when. The event id is an audit detail and lives under "How this is calculated". */
function Head({ e, htAt }: { e: MatchEvent; htAt: number }) {
  const who = useWho()
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-2 text-base font-semibold text-fg-1">
          <TeamDot team={e.team} />
          {eventTypeLabel(e)}
        </p>
        <p className="shrink-0 text-xs tabular-nums text-fg-3">
          {fmtClock(e.t)} · {periodName(e.t, htAt)}
        </p>
      </div>
      <p className="mt-0.5 truncate text-sm text-fg-2" title={describeEvent(e, who)}>
        {describeEvent(e, who)}
      </p>
    </div>
  )
}

/**
 * Context for the rating on one line: pressure on the player and how certain the tracking was.
 * Low confidence keeps its own channel (a dashed edge and a note), never a hue.
 */
function Facts({ e, pressure = true }: { e: MatchEvent; pressure?: boolean }) {
  const high = e.press >= HIGH_PRESSURE
  const low = confLevel(e.conf) === 'low'
  return (
    <div className="mt-3.5">
      <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
        {pressure ? (
          <div className="flex items-baseline gap-1.5">
            <dt className="text-fg-3">{t('explain.pressure_short')}</dt>
            <dd className="flex items-baseline gap-1.5">
              <span className="font-mono tabular-nums text-fg-1">{e.press.toFixed(2)}</span>
              {high ? (
                <Threshold id="high_pressure" className="text-xs">
                  {t('explain.high_pressure')}
                </Threshold>
              ) : (
                <span className="text-xs text-fg-3">{t('explain.not_high_short')}</span>
              )}
            </dd>
          </div>
        ) : null}
        <div className={cn('flex items-center gap-1.5', low && '-mx-1.5 -my-1 rounded-md border border-dashed border-[var(--conf-ink)] px-1.5 py-1')}>
          <dt className="text-fg-3">{t('explain.tracking_short')}</dt>
          <dd>
            <ConfidenceIndicator value={e.conf} className="text-[13px]" />
          </dd>
        </div>
      </dl>
      {e.confNote || low ? <p className="mt-2 text-xs text-fg-2">{e.confNote ?? t('explain.low_conf_generic')}</p> : null}
    </div>
  )
}

/**
 * The 0 to 1.5 scale, drawn as the four bands in their own colours so the cut-offs explain themselves.
 * The marker sits at the score; 1.0 is marked because above it the outcome beat every option.
 */
function DqScale({ value }: { value: number }) {
  const pct = (v: number) => `${(Math.min(DQ_MAX, Math.max(0, v)) / DQ_MAX) * 100}%`
  const segs: { band: Band; from: number; to: number }[] = [
    { band: 'poor', from: 0, to: BAND_THRESHOLDS.suboptimal },
    { band: 'suboptimal', from: BAND_THRESHOLDS.suboptimal, to: BAND_THRESHOLDS.good },
    { band: 'good', from: BAND_THRESHOLDS.good, to: BAND_THRESHOLDS.optimal },
    { band: 'optimal', from: BAND_THRESHOLDS.optimal, to: DQ_MAX },
  ]
  return (
    <div className="mt-3" role="img" aria-label={t('explain.scale_aria', { v: value.toFixed(2), max: DQ_MAX.toFixed(1) })}>
      <div className="relative h-1.5">
        {segs.map((sg) => (
          <span
            key={sg.band}
            aria-hidden
            className="absolute inset-y-0 rounded-[2px]"
            style={{ left: `calc(${pct(sg.from)} + 1px)`, width: `calc(${pct(sg.to)} - ${pct(sg.from)} - 2px)`, background: `color-mix(in srgb, var(--dq-${sg.band}) 55%, transparent)` }}
          />
        ))}
        <span aria-hidden className="absolute -top-1 h-3.5 w-px bg-fg-3" style={{ left: pct(DQ_ELEVATED) }} />
        <span aria-hidden className="absolute -top-[5px] size-4 -translate-x-1/2 rounded-full border-[3px] border-s2 bg-fg-1" style={{ left: pct(value) }} />
      </div>
      <div aria-hidden className="relative mt-1.5 h-3 font-mono text-[10px] tabular-nums text-fg-4">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(DQ_ELEVATED) }}>1.0</span>
        <span className="absolute right-0">{DQ_MAX.toFixed(1)}</span>
      </div>
    </div>
  )
}

function useAlts(e: MatchEvent) {
  const who = useWho()
  const label = (a: { label: string; num?: number }) => (a.num !== undefined ? [who(e.team, a.num), ...a.label.split(', ').slice(1)].join(', ') : a.label)
  const alts = [...(e.alts ?? [])].sort((a, b) => a.rank - b.rank)
  return { alts, label }
}

/**
 * A rated pass or carry. Reads top to bottom as an answer: the score and its band, one sentence
 * saying what was played against the best option, then the options as simple bars. The raw value,
 * probability and working sit under "How this is calculated".
 */
function Measured({ e, how }: { e: MatchEvent; how?: boolean }) {
  const { alts, label } = useAlts(e)
  const chosen = alts.find((a) => a.chosen)
  const best = alts[0]
  const top = Math.max(...alts.map((a) => a.s), 0.0001)
  const verdict = !best
    ? null
    : chosen && chosen.rank === best.rank
      ? t('explain.verdict_best', { n: alts.length })
      : chosen
        ? t('explain.verdict_other', { r: chosen.rank, n: alts.length, best: label(best) })
        : t('explain.verdict_none', { best: label(best) })
  return (
    <>
      <div className="mt-3 rounded-xl bg-s2 px-4 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[32px] font-semibold leading-none tracking-tight tabular-nums text-fg-1" aria-label={`${t('explain.ratio')} ${(e.dq ?? 0).toFixed(2)}`}>
              {(e.dq ?? 0).toFixed(2)}
            </p>
            <p className="mt-1.5 text-xs text-fg-3">{t('explain.decision_quality')}</p>
          </div>
          {e.band ? <DqBand band={e.band} size="lg" /> : null}
        </div>
        <DqScale value={e.dq ?? 0} />
        {verdict ? <p className="mt-2 break-keep text-sm leading-5 text-fg-1">{verdict}</p> : null}
        {(e.dq ?? 0) >= DQ_ELEVATED ? <p className="mt-1.5 text-xs text-fg-2">{t('explain.elevated')}</p> : null}
        {/* The working belongs to the score, so its disclosure sits here rather than in its own row. */}
        <Collapsible.Trigger className="group mt-2 inline-flex items-center gap-1 text-xs text-fg-3 hover:text-fg-1">
          {t('explain.how')}
          <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </Collapsible.Trigger>
      </div>
      <HowContent e={e} />

      {/* With the working open, its full table replaces the bars, so the options are not shown twice. */}
      {alts.length && !how ? (
        <div className="mt-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium text-fg-3">{t('explain.alternatives')}</p>
            <p className="text-xs text-fg-4">{t('explain.score_caption')}</p>
          </div>
          <ol className="mt-1.5 flex flex-col">
            {alts.map((a) => (
              <li key={a.rank} className="grid grid-cols-[16px_minmax(0,1fr)_64px_32px] items-center gap-2 py-1 text-[13px]">
                <span className="font-mono text-xs tabular-nums text-fg-4">{a.rank}</span>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className={cn('truncate', a.chosen ? 'text-fg-1' : 'text-fg-2')} title={label(a)}>
                    {label(a)}
                  </span>
                  {a.chosen ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-medium text-fg-1">
                      <span aria-hidden className="size-1.5 rounded-full bg-highlight" />
                      {t('explain.played')}
                    </span>
                  ) : null}
                </span>
                <span aria-hidden className="h-1.5 rounded-full bg-s3">
                  <span className={cn('block h-full rounded-full', a.chosen ? 'bg-highlight' : a.rank === 1 ? 'bg-fg-2' : 'bg-fg-4')} style={{ width: `${Math.max(4, (a.s / top) * 100)}%` }} />
                </span>
                <span className="text-right font-mono text-xs tabular-nums text-fg-2">{a.s.toFixed(2)}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <Facts e={e} />
    </>
  )
}

function EventOnly({ e }: { e: MatchEvent }) {
  return (
    <>
      <div className="mt-3 rounded-md border border-dashed border-hair-strong p-2.5 pattern-rule">
        <p className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
          <TriangleAlert className="size-3" aria-hidden />
          {t('explain.eo_label')}
        </p>
        <div className="mt-2">{e.est ? <EstimateBand lo={e.est.lo} hi={e.est.hi} size="lg" /> : null}</div>
        <p className="mt-2 text-xs text-fg-2">{t('explain.eo_body')}</p>
        <p className="mt-1.5 text-xs text-fg-3">
          <Threshold id="event_only" />
        </p>
      </div>
      <div className="mt-3 rounded-lg bg-canvas p-2.5">
        <p className="text-xs font-medium text-fg-4">{t('explain.working')}</p>
        <p className="mt-1 text-xs text-fg-2">{t('explain.eo_inputs')}</p>
        <p className="mt-1 text-xs text-fg-3">{t('explain.eo_no_alts')}</p>
      </div>
      <dl className="mt-2">
        <Row label={t('explain.pressure_tag')}>
          <span className="font-mono tabular-nums">{e.press.toFixed(2)}</span>
        </Row>
      </dl>
      <Facts e={e} pressure={false} />
    </>
  )
}

function Run({ e }: { e: MatchEvent }) {
  return (
    <>
      <div className="mt-3 rounded-xl bg-s2 px-4 pb-3 pt-3.5">
        <p className="font-mono text-[32px] font-semibold leading-none tracking-tight tabular-nums text-fg-1">+{(e.ovm ?? 0).toFixed(2)}</p>
        <p className="mt-1.5 text-xs text-fg-3">{t('explain.ovm')}</p>
        <p className="mt-2 text-sm leading-5 text-fg-1">{t('explain.ovm_sub')}</p>
        <p className="mt-2 font-mono text-xs tabular-nums text-fg-3">
          V(end) − V(start) = {(e.ovmTo ?? 0).toFixed(2)} − {(e.ovmFrom ?? 0).toFixed(2)}
        </p>
      </div>
      <p className="mt-2 text-xs text-fg-3">
        <Threshold id="value_surface" />
      </p>
      <Facts e={e} pressure={false} />
    </>
  )
}

function Effort({ e }: { e: MatchEvent }) {
  return (
    <>
      <dl className="mt-3 divide-y divide-[var(--hairline)]">
        <Row label={t('explain.peak_speed')}>
          <span className="font-mono tabular-nums">{e.effort ? e.effort.peak.toFixed(1) : '0.0'} m/s</span>
        </Row>
        <Row label={t('explain.distance')}>
          <span className="font-mono tabular-nums">{e.effort ? Math.round(e.effort.dist) : 0} m</span>
        </Row>
        <Row label={t('explain.duration')}>
          <span className="font-mono tabular-nums">{e.dur.toFixed(1)} s</span>
        </Row>
      </dl>
      <p className="mt-3 rounded-lg bg-s2 p-2.5 text-xs text-fg-2">{t('explain.effort_note')}</p>
      <Facts e={e} pressure={false} />
    </>
  )
}

function Simple({ e }: { e: MatchEvent }) {
  return (
    <>
      <dl className="mt-3 divide-y divide-[var(--hairline)]">
        <Row label={t('explain.outcome')}>{t(`outcome.${e.outcome}`)}</Row>
      </dl>
      <p className="mt-2 text-xs text-fg-3">{e.type === 'shot' ? t('explain.shot_note') : t('explain.def_note')}</p>
      <Facts e={e} />
    </>
  )
}

/** Everything an analyst needs to check the rating: the working, the raw option values, the definitions and the event reference. */
function HowContent({ e }: { e: MatchEvent }) {
  const { alts, label } = useAlts(e)
  return (
    <Collapsible.Content className="mt-3 flex flex-col gap-2 text-xs text-fg-2">
      <div className="rounded-lg bg-s2 px-3 py-2">
        <p className="text-xs font-medium text-fg-3">{t('explain.working')}</p>
        <p className="mt-0.5 font-mono text-[13px] tabular-nums text-fg-1">V(at arrival) ÷ V(best at release)</p>
        <p className="font-mono text-[13px] tabular-nums text-fg-2">
          = {(e.vA ?? 0).toFixed(2)} ÷ {(e.vB ?? 0).toFixed(2)} = {(e.dq ?? 0).toFixed(2)}
        </p>
      </div>
      {alts.length ? (
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col className="w-5" />
            <col />
            <col className="w-10" />
            <col className="w-10" />
            <col className="w-11" />
          </colgroup>
          <thead>
            <tr className="text-left text-fg-3">
              <th className="py-0.5 font-medium">{t('explain.col_rank')}</th>
              <th className="py-0.5 font-medium">{t('explain.col_option')}</th>
              <th className="py-0.5 text-right font-medium" title={t('explain.col_v')}>V</th>
              <th className="py-0.5 text-right font-medium" title={t('explain.col_p')}>p</th>
              <th className="whitespace-nowrap py-0.5 text-right font-medium">V × p</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {alts.map((a) => (
              <tr key={a.rank} className="border-t border-hair">
                <td className="py-1 font-mono text-fg-3">{a.rank}</td>
                <td className="truncate py-1 pr-2 text-fg-2" title={label(a)}>
                  {label(a)}
                </td>
                <td className="py-1 text-right font-mono">{a.v.toFixed(2)}</td>
                <td className="py-1 text-right font-mono">{a.p.toFixed(2)}</td>
                <td className="py-1 text-right font-mono text-fg-1">{a.s.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p>{t('explain.how_1')}</p>
      <p>{t('explain.how_2')}</p>
      <p>
        {t('explain.how_3')} <Threshold id="decision_quality" /> <Threshold id="ring" />
      </p>
      <p className="text-fg-4">
        {t('explain.reference')} <span className="font-mono">{e.id}</span>
      </p>
    </Collapsible.Content>
  )
}

function useAnnounce() {
  const who = useWho()
  return (e: MatchEvent) =>
    [
      t('explain.selected'),
      `${eventTypeLabel(e)}, ${describeEvent(e, who)}`,
      fmtClock(e.t),
      e.band && e.dq !== undefined ? t('explain.announce_dq', { v: e.dq.toFixed(2), band: t(`band.${e.band}`) }) : null,
    ]
      .filter(Boolean)
      .join('. ')
}

/**
 * `compact` is used while the Ask tab is open on Replay: the card shrinks to its header and rating
 * so the conversation has room, and opens fully on request. `onAsk` starts a question about the moment.
 */
export function ExplainCard({ event, htAt, onPlayFrom, onCopy, onAsk, compact }: { event: MatchEvent | null; htAt: number; onPlayFrom: (e: MatchEvent) => void; onCopy: (e: MatchEvent) => void; onAsk?: (e: MatchEvent) => void; compact?: boolean }) {
  const [how, setHow] = useState(false)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => setExpanded(false), [compact])
  const announce = useAnnounce()
  // Always mounted, so screen readers hear the first selection as well as later ones.
  const live = (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {event ? announce(event) : ''}
    </p>
  )
  if (!event) {
    return (
      <>
        {live}
        <section aria-label={t('explain.title')} className="rounded-lg border border-dashed border-hair-strong p-4">
          <p className="text-sm font-medium text-fg-1">{t('explain.empty_title')}</p>
          <p className="mt-1 text-sm text-fg-3">{t('explain.empty_body')}</p>
        </section>
      </>
    )
  }
  const e = event
  const measured = !e.est && !!e.band
  if (compact && !expanded) {
    return (
      <>
        {live}
        <section aria-label={t('explain.title')} className={cn('rounded-lg border bg-s1 px-3.5 py-3', e.est ? 'border-dashed border-hair-strong' : 'border-transparent')}>
          <Head e={e} htAt={htAt} />
          <div className="mt-2 flex items-center gap-2.5">
            {e.band && e.dq !== undefined ? (
              <>
                <span className="font-mono text-xl font-semibold leading-none tabular-nums text-fg-1">{e.dq.toFixed(2)}</span>
                <DqBand band={e.band} />
              </>
            ) : e.est ? (
              <EstimateBand lo={e.est.lo} hi={e.est.hi} />
            ) : null}
            <Button size="sm" variant="ghost" className="ml-auto" aria-expanded={false} onClick={() => setExpanded(true)}>
              {t('explain.show_details')}
              <ChevronDown className="size-3.5" aria-hidden />
            </Button>
          </div>
        </section>
      </>
    )
  }
  return (
    <>
    {/* One short announcement per selection, rather than reading out the whole card. */}
    {live}
    <section aria-label={t('explain.title')} className={cn('rounded-xl border bg-s1 p-4', e.est ? 'border-dashed border-hair-strong' : 'border-transparent')}>
      <Head e={e} htAt={htAt} />
      <Collapsible.Root open={how} onOpenChange={setHow}>
      {e.est ? <EventOnly e={e} /> : e.band ? <Measured e={e} how={how} /> : e.type === 'run' ? <Run e={e} /> : e.type === 'effort' ? <Effort e={e} /> : <Simple e={e} />}
        <div className="mt-3.5 flex items-center gap-1 border-t border-hair pt-3">
          <Button size="sm" variant="primary" onClick={() => onPlayFrom(e)}>
            <Play className="size-3 fill-current" aria-hidden />
            {t('explain.play_from')}
          </Button>
          <div className="ml-auto flex items-center gap-0.5">
            {onAsk ? (
              <Tooltip content={t('askp.ask_moment')}>
                <Button size="icon-sm" variant="ghost" aria-label={t('askp.ask_moment')} onClick={() => onAsk(e)}>
                  <MessageSquarePlus className="size-3.5" aria-hidden />
                </Button>
              </Tooltip>
            ) : null}
            <Tooltip content={t('explain.copy_link')}>
              <Button size="icon-sm" variant="ghost" aria-label={t('explain.copy_link')} onClick={() => onCopy(e)}>
                <Copy className="size-3.5" aria-hidden />
              </Button>
            </Tooltip>
            <Tooltip content={t('explain.video_later')}>
              <span tabIndex={0} className="rounded-md">
                <Button size="icon-sm" variant="ghost" disabled aria-label={t('explain.video')}>
                  <Video className="size-3.5" aria-hidden />
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>
        {compact ? (
          <button type="button" onClick={() => setExpanded(false)} className="mt-2 text-xs text-fg-3 hover:text-fg-1">
            {t('explain.hide_details')}
          </button>
        ) : null}
      </Collapsible.Root>
    </section>
    </>
  )
}
