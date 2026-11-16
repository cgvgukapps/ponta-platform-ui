import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ArrowRight, ChevronDown, Download, FlaskConical, Layers, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { FAMILIES, type Match, type MetricId, type ParityState } from '@/lib/types'
import { familyState, parityFor, getMatchesSync } from '@/api'
import { fmtDateTime } from '@/lib/format'
import { Button, buttonStyles } from '@/components/ui/button'
import { InlineAlert } from '@/components/ui/feedback'
import { ParityBadge, ParityIcon, Tag, TierBadge, TierGlyph } from '@/components/ui/badges'
import { useApp } from '@/state/app'

/**
 * One count as a tile (reference: one large figure, a small label beneath). The state mark sits
 * with its word, not beside the number, so the figure leads.
 */
function SummaryStat({ state, n, total }: { state: ParityState; n: number; total: number }) {
  return (
    <div className="flex flex-col justify-between rounded-xl bg-s1 px-5 pb-4 pt-5">
      <p className="font-mono text-[40px] font-semibold leading-none tracking-tight tabular-nums text-fg-1">
        {n}
        <span className="ml-1.5 text-lg font-medium text-fg-4">/ {total}</span>
      </p>
      <div className="mt-4">
        <p className={cn('flex items-center gap-2 text-sm font-medium', state === 'blocked' ? 'text-parity-dim' : 'text-parity')}>
          <ParityIcon state={state} size={13} />
          <span className="text-fg-1">{t(`parity.${state}`)}</span>
        </p>
        <p className="mt-1 text-xs text-fg-3">{t(`gate.stat_hint_${state}`)}</p>
      </div>
    </div>
  )
}

function MetricRow({ id, report, familyState, familyLabel }: { id: MetricId; report: ReturnType<typeof parityFor>; familyState: ParityState; familyLabel: string }) {
  const m = report.metrics[id]
  const label = t(`metric.${id}`)
  // The family badge already states the common case. A row repeats a badge only when it differs,
  // and drops its title when it would only repeat the family name.
  const differs = m.state !== familyState
  const showTitle = differs || label !== familyLabel
  return (
    <div className="flex flex-col gap-1.5 border-t border-hair py-3 first:border-t-0 first:pt-0 last:pb-0">
      {showTitle ? (
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-fg-1">{label}</h4>
          {differs ? <ParityBadge state={m.state} /> : null}
        </div>
      ) : null}
      <p className="text-sm leading-5 text-fg-2">{m.reason}</p>
      {m.measure ? <p className="font-mono text-xs text-fg-3">{m.measure}</p> : null}
      {m.state !== 'full' ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-3">
          <span className="font-medium text-fg-2">{t('gate.would_change')}</span>
          <span>{m.unlock}</span>
          {m.inDevelopment ? <Tag dashed className="h-4 px-1 text-[10px]">{t('tier.in_development')}</Tag> : null}
        </p>
      ) : null}
    </div>
  )
}

/**
 * One family as a row of a single list (reference: settings rows with the label left, the state
 * beside it and detail beneath), instead of a card per family.
 */
function FamilyRow({ family, report }: { family: (typeof FAMILIES)[number]; report: ReturnType<typeof parityFor> }) {
  const state = familyState(report, family)
  return (
    <section aria-labelledby={`fam-${family.id}`} className="grid grid-cols-[220px_minmax(0,1fr)] gap-6 border-t border-hair px-5 py-5 first:border-t-0">
      <header>
        <div className="flex items-center gap-2.5">
          <h3 id={`fam-${family.id}`} className="text-base font-semibold text-fg-1">
            {t(`family.${family.id}`)}
          </h3>
        </div>
        <p className="mt-1 text-xs leading-[18px] text-fg-3">{t(`family.${family.id}.desc`)}</p>
        <ParityBadge state={state} className="mt-3" />
      </header>
      <div className="flex flex-col">
        {family.metrics.map((id) => (
          <MetricRow key={id} id={id} report={report} familyState={state} familyLabel={t(`family.${family.id}`)} />
        ))}
      </div>
    </section>
  )
}

/**
 * What a second source would unlock. Reference style: a plain heading, rows with a numbered
 * circle (white for this match), one line each, quiet "In development" text, then the match's
 * suggestion on its own tile and a single primary action.
 */
function Ladder({ match }: { match: Match }) {
  const { toast } = useApp()
  const report = useMemo(() => parityFor(match), [match])
  const optical = parityFor({ ...getMatchesSync().find((m) => m.parityProfile === 'optical_full')! })
  const improvable = (Object.keys(report.metrics) as MetricId[]).filter((k) => report.metrics[k].state !== 'full' && optical.metrics[k].state === 'full' && !report.metrics[k].inDevelopment).length
  const kind = match.sources[0].kind
  const suggestion =
    kind === 'events' ? t('gate.suggest_events', { n: improvable }) : kind === 'gps' ? t('gate.suggest_gps') : match.tier === 1 ? t('gate.suggest_optical') : t('gate.suggest_dev')
  const steps = [
    { tier: 1 as const, title: t('gate.t1_title'), who: t('gate.t1_who'), unlocks: t('gate.t1_unlocks'), live: true },
    { tier: 2 as const, title: t('gate.t2_title'), who: t('gate.t2_who'), unlocks: t('gate.t2_unlocks'), live: false },
    { tier: 3 as const, title: t('gate.t3_title'), who: t('gate.t3_who'), unlocks: t('gate.t3_unlocks'), live: false },
  ]
  return (
    <aside aria-labelledby="ladder-title" className="rounded-xl bg-s1 p-5">
      <h3 id="ladder-title" className="text-base font-semibold text-fg-1">
        {t('gate.ladder_title')}
      </h3>
      <p className="mt-1 text-sm text-fg-3">{t('gate.ladder_intro')}</p>

      <ol className="mt-4 flex flex-col">
        {steps.map((s) => {
          const here = s.tier === match.tier
          return (
            <li key={s.tier} aria-current={here ? 'step' : undefined} className="flex gap-3.5 border-t border-hair py-3.5 first:border-t-0 first:pt-1">
              <span
                aria-hidden
                className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums', here ? 'bg-primary-fill text-on-primary' : 'bg-s3 text-fg-3')}
              >
                {s.tier}
              </span>
              {/* Two sizes in the whole panel: the heading, and 14 px for everything else.
                  Hierarchy comes from weight and shade only. */}
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className={cn('font-medium', here || s.live ? 'text-fg-1' : 'text-fg-2')} title={s.who}>{s.title}</h4>
                  <span className="shrink-0 text-fg-3">{here ? t('gate.you_are_here') : !s.live ? t('tier.in_development') : ''}</span>
                </div>
                <p className="mt-1 text-fg-3">{s.unlocks}</p>
              </div>
            </li>
          )
        })}
      </ol>

      <p className="mt-3 rounded-lg bg-s2 p-4 text-sm text-fg-1">{suggestion}</p>
      <div className="mt-3 flex flex-col items-stretch gap-1">
        <Link to={`/matches/new?match=${match.id}`} className={buttonStyles({ variant: 'primary' })}>
          <Plus className="size-4" aria-hidden />
          {t('gate.add_source')}
        </Link>
        <button
          type="button"
          onClick={() => toast({ title: t('gate.toast_notify'), body: t('gate.toast_notify_body') })}
          className="h-9 rounded-lg text-sm text-fg-3 transition-colors hover:bg-s2 hover:text-fg-1"
        >
          {t('gate.notify')}
        </button>
      </div>
    </aside>
  )
}

export function ParityGate({ match, continueLabel, onContinue, continueTo, footerExtra, hideStats, embedded }: { match: Match; continueLabel: string; onContinue?: () => void; continueTo?: string; footerExtra?: ReactNode; hideStats?: boolean; embedded?: boolean }) {
  const report = useMemo(() => parityFor(match), [match])
  const [open, setOpen] = useState(false)
  const { toast } = useApp()
  const dev = match.tierStatus === 'in_development'
  const primary = continueTo ? (
    <Link to={continueTo} className={buttonStyles({ variant: 'primary', size: 'lg' })}>
      {continueLabel}
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  ) : (
    <Button variant="primary" size="lg" onClick={onContinue}>
      {continueLabel}
      <ArrowRight className="size-4" aria-hidden />
    </Button>
  )
  return (
    <div className={embedded ? 'flex flex-1 flex-col' : 'mx-auto max-w-[1240px] px-6 py-6'}>
      <div className="max-w-[720px]">
        <h2 className="text-xl font-semibold text-fg-1">{t('gate.title')}</h2>
        <p className="mt-1.5 text-base text-fg-3">{t('gate.intro')}</p>
      </div>
      {(() => {
        const total = report.summary.full + report.summary.degraded + report.summary.blocked
        return (
          <div className="mt-5 grid grid-cols-3 gap-3">
            <SummaryStat state="full" n={report.summary.full} total={total} />
            <SummaryStat state="degraded" n={report.summary.degraded} total={total} />
            <SummaryStat state="blocked" n={report.summary.blocked} total={total} />
          </div>
        )
      })()}

      {dev ? (
        <InlineAlert className="mt-5" icon={<FlaskConical className="size-4" />} title={t('gate.dev_title')}>
          {t('gate.dev_body')}
        </InlineAlert>
      ) : null}

      {!hideStats ? (
        <dl className="mt-5 grid grid-cols-6 divide-x divide-hair overflow-hidden rounded-xl bg-s1 text-sm">
          {[
            [t('gate.stat_source'), match.sources.map((s) => s.label).join(' + ')],
            [t('gate.stat_tier'), <TierBadge key="t" tier={match.tier} status={match.tierStatus} />],
            [t('gate.stat_duration'), `${match.ingest.durationMin} min`],
            [t('gate.stat_rate'), match.ingest.hz ? `${match.ingest.hz} Hz` : t('gate.stat_events_only')],
            [t('gate.stat_players'), String(match.ingest.players)],
            [t('gate.stat_dropped'), match.ingest.droppedPct !== null ? `${match.ingest.droppedPct}%` : t('common.not_applicable')],
          ].map(([k, v], i) => (
            <div key={i} className="min-w-0 px-4 py-3">
              <dt className="text-xs font-medium text-fg-4">{k as string}</dt>
              <dd className="mt-1 truncate font-mono text-sm tabular-nums text-fg-1">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_340px] items-start gap-5">
        <div className="rounded-xl bg-s1">
          {FAMILIES.map((f) => (
            <FamilyRow key={f.id} family={f} report={report} />
          ))}
        </div>
        <div className="sticky top-4">
          <Ladder match={match} />
        </div>
      </div>

      <Collapsible.Root open={open} onOpenChange={setOpen} className="mt-6 rounded-xl bg-s1">
        <Collapsible.Trigger className="flex w-full items-center justify-between px-4 py-3 text-sm text-fg-2 hover:text-fg-1">
          <span>{t('gate.tech_title')}</span>
          <ChevronDown className={cn('size-4 transition-transform duration-[var(--dur-base)]', open && 'rotate-180')} aria-hidden />
        </Collapsible.Trigger>
        <Collapsible.Content className="border-t border-hair px-4 py-3">
          <dl className="grid grid-cols-[180px_1fr] gap-y-1.5 font-mono text-xs">
            <dt className="text-fg-4">{t('gate.tech_engine')}</dt>
            <dd className="text-fg-2">{t('gate.tech_engine_value', { v: report.engineVersion })}</dd>
            <dt className="text-fg-4">{t('gate.tech_processed')}</dt>
            <dd className="text-fg-2">{fmtDateTime(report.generatedAt)}</dd>
            <dt className="text-fg-4">{t('gate.tech_format')}</dt>
            <dd className="text-fg-2">{match.ingest.format}</dd>
            <dt className="text-fg-4">{t('gate.tech_threshold')}</dt>
            <dd className="text-fg-2">{t('gate.tech_threshold_value')}</dd>
            <dt className="text-fg-4">{t('gate.tech_occlusion')}</dt>
            <dd className="text-fg-2">{match.ingest.occludedPct !== null ? `${match.ingest.occludedPct}%` : t('common.not_applicable')}</dd>
          </dl>
        </Collapsible.Content>
      </Collapsible.Root>

      {embedded ? <div className="min-h-10 flex-1" /> : null}
      <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t border-hair', embedded ? 'sticky bottom-0 z-10 -mx-8 bg-canvas/95 px-8 py-4 backdrop-blur' : 'mt-6 pt-5')}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => toast({ title: t('gate.toast_export'), body: t('gate.toast_export_body') })}>
            <Download className="size-3.5" aria-hidden />
            {t('gate.export')}
          </Button>
          {footerExtra}
        </div>
        {primary}
      </div>
    </div>
  )
}
