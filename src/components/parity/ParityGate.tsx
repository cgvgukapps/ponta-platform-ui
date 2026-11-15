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

function SummaryStat({ state, n }: { state: ParityState; n: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hair bg-s1 px-4 py-3">
      <span className={cn('flex size-8 items-center justify-center', state === 'full' ? 'text-parity' : state === 'degraded' ? 'text-parity' : 'text-parity-dim')}>
        <ParityIcon state={state} size={22} />
      </span>
      <div>
        <p className="font-mono text-xl font-semibold leading-none tabular-nums text-fg-1">{n}</p>
        <p className="mt-1 text-xs text-fg-3">{t(`parity.${state}`)}</p>
      </div>
    </div>
  )
}

function MetricRow({ id, report }: { id: MetricId; report: ReturnType<typeof parityFor> }) {
  const m = report.metrics[id]
  return (
    <div className="flex flex-col gap-1.5 border-t border-hair py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-fg-1">{t(`metric.${id}`)}</h4>
        <ParityBadge state={m.state} />
      </div>
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

function FamilyCard({ family, report }: { family: (typeof FAMILIES)[number]; report: ReturnType<typeof parityFor> }) {
  const state = familyState(report, family)
  return (
    <section aria-labelledby={`fam-${family.id}`} className={cn('flex flex-col rounded-lg border bg-s1', state === 'blocked' ? 'border-hair' : 'border-hair-strong')}>
      <header className={cn('flex items-start justify-between gap-3 rounded-t-lg border-b border-hair px-4 py-3',)}>
        <div>
          <h3 id={`fam-${family.id}`} className="text-base font-semibold text-fg-1">
            {t(`family.${family.id}`)}
          </h3>
          <p className="mt-0.5 text-xs text-fg-3">{t(`family.${family.id}.desc`)}</p>
        </div>
        <ParityBadge state={state} size="lg" />
      </header>
      <div className="flex flex-col px-4 py-3">
        {family.metrics.map((id) => (
          <MetricRow key={id} id={id} report={report} />
        ))}
      </div>
    </section>
  )
}

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
    <aside aria-labelledby="ladder-title" className="rounded-lg border border-hair-strong bg-s1">
      <div className="border-b border-hair px-4 py-3">
        <h3 id="ladder-title" className="flex items-center gap-2 text-base font-semibold text-fg-1">
          <Layers className="size-4 text-fg-3" aria-hidden />
          {t('gate.ladder_title')}
        </h3>
        <p className="mt-1 text-sm text-fg-3">{t('gate.ladder_intro')}</p>
      </div>
      <ol className="px-4 py-4">
        {steps.map((s, i) => {
          const here = s.tier === match.tier
          return (
            <li key={s.tier} className="relative flex gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 ? <span aria-hidden className="absolute left-[11px] top-7 h-[calc(100%-20px)] w-px border-l border-dashed border-hair-strong" /> : null}
              <span className={cn('relative z-10 flex size-6 shrink-0 items-center justify-center rounded-md border bg-s1', here ? 'border-accent text-fg-1' : 'border-hair-strong text-fg-3')}>
                <TierGlyph tier={s.tier} size={14} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-medium text-fg-1">{s.title}</h4>
                  {here ? <Tag className="h-4 border-accent px-1 text-[10px] text-fg-1">{t('gate.you_are_here')}</Tag> : null}
                  {!s.live ? <Tag dashed className="h-4 px-1 text-[10px]">{t('tier.in_development')}</Tag> : null}
                </div>
                <p className="mt-0.5 text-xs text-fg-3">{s.who}</p>
                <p className="mt-1.5 text-sm text-fg-2">{s.unlocks}</p>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="border-t border-hair bg-s2 px-4 py-3">
        <p className="text-sm text-fg-1">{suggestion}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`/matches/new?match=${match.id}`} className={buttonStyles({ variant: 'secondary' })}>
            <Plus className="size-3.5" aria-hidden />
            {t('gate.add_source')}
          </Link>
          <Button variant="ghost" onClick={() => toast({ title: t('gate.toast_notify'), body: t('gate.toast_notify_body') })}>
            {t('gate.notify')}
          </Button>
        </div>
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[640px]">
          <h2 className="text-xl font-semibold text-fg-1">{t('gate.title')}</h2>
          <p className="mt-1.5 text-base text-fg-3">{t('gate.intro')}</p>
        </div>
        <div className="flex items-center gap-2">
          <SummaryStat state="full" n={report.summary.full} />
          <SummaryStat state="degraded" n={report.summary.degraded} />
          <SummaryStat state="blocked" n={report.summary.blocked} />
        </div>
      </div>

      {dev ? (
        <InlineAlert className="mt-5" icon={<FlaskConical className="size-4" />} title={t('gate.dev_title')}>
          {t('gate.dev_body')}
        </InlineAlert>
      ) : null}

      {!hideStats ? (
        <dl className="mt-5 grid grid-cols-6 divide-x divide-hair overflow-hidden rounded-lg border border-hair bg-s1 text-sm">
          {[
            [t('gate.stat_source'), match.sources.map((s) => s.label).join(' + ')],
            [t('gate.stat_tier'), <TierBadge key="t" tier={match.tier} status={match.tierStatus} />],
            [t('gate.stat_duration'), `${match.ingest.durationMin} min`],
            [t('gate.stat_rate'), match.ingest.hz ? `${match.ingest.hz} Hz` : t('gate.stat_events_only')],
            [t('gate.stat_players'), String(match.ingest.players)],
            [t('gate.stat_dropped'), match.ingest.droppedPct !== null ? `${match.ingest.droppedPct}%` : t('common.not_applicable')],
          ].map(([k, v], i) => (
            <div key={i} className="min-w-0 px-4 py-3">
              <dt className="font-mono text-2xs uppercase tracking-wider text-fg-4">{k as string}</dt>
              <dd className="mt-1 truncate font-mono text-sm tabular-nums text-fg-1">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_340px] items-start gap-5">
        <div className="grid grid-cols-2 items-start gap-4">
          {FAMILIES.map((f) => (
            <FamilyCard key={f.id} family={f} report={report} />
          ))}
        </div>
        <div className="sticky top-4">
          <Ladder match={match} />
        </div>
      </div>

      <Collapsible.Root open={open} onOpenChange={setOpen} className="mt-6 rounded-lg border border-hair bg-s1">
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
