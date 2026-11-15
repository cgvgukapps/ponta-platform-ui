import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown, Copy, Play, TriangleAlert, Video } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import type { MatchEvent } from '@/lib/types'
import { fmtClock } from '@/lib/format'
import { eventTypeLabel, describeEvent, periodName } from '@/lib/events'
import { BAND_THRESHOLDS, DQ_ELEVATED, DQ_MAX, HIGH_PRESSURE, confLevel } from '@/lib/bands'
import { Button } from '@/components/ui/button'
import { ConfidenceIndicator, DqBand, EstimateBand, TeamDot } from '@/components/ui/badges'
import { Threshold } from '@/components/ui/threshold'
import { Tooltip } from '@/components/ui/overlay'

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <dt className="text-fg-3">{label}</dt>
      <dd className="text-right text-fg-1">{children}</dd>
    </div>
  )
}

function Head({ e, htAt }: { e: MatchEvent; htAt: number }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider text-fg-4">
          <span>{e.id}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{fmtClock(e.t)}</span>
          <span aria-hidden>·</span>
          <span>{periodName(e.t, htAt)}</span>
        </p>
        <p className="mt-1 flex items-center gap-2 text-md font-medium text-fg-1">
          <TeamDot team={e.team} />
          {eventTypeLabel(e)}
        </p>
        <p className="text-sm text-fg-3">{describeEvent(e)}</p>
      </div>
    </div>
  )
}

function Confidence({ e }: { e: MatchEvent }) {
  const low = confLevel(e.conf) === 'low'
  return (
    <div className={cn('mt-3 rounded-md border p-2.5', low ? 'border-dashed border-[var(--conf-ink)]' : 'border-hair')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-fg-3">{t('explain.confidence')}</span>
        <ConfidenceIndicator value={e.conf} />
      </div>
      {e.confNote ? <p className="mt-1.5 text-xs text-fg-2">{e.confNote}</p> : low ? <p className="mt-1.5 text-xs text-fg-2">{t('explain.low_conf_generic')}</p> : null}
    </div>
  )
}

function Pressure({ e }: { e: MatchEvent }) {
  const high = e.press >= HIGH_PRESSURE
  return (
    <Row label={t('explain.pressure')}>
      <span className="font-mono tabular-nums">{e.press.toFixed(2)}</span>{' '}
      {high ? (
        <Threshold id="high_pressure" className="text-xs">
          {t('explain.high_pressure')}
        </Threshold>
      ) : (
        <span className="text-xs text-fg-3">{t('explain.not_high')}</span>
      )}
    </Row>
  )
}

function Tiles({ e }: { e: MatchEvent }) {
  const high = e.press >= HIGH_PRESSURE
  const low = confLevel(e.conf) === 'low'
  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-hair p-2">
          <p className="text-xs text-fg-3">{t('explain.pressure')}</p>
          <p className="mt-0.5 flex items-baseline gap-1.5 text-sm">
            <span className="font-mono tabular-nums text-fg-1">{e.press.toFixed(2)}</span>
            {high ? (
              <Threshold id="high_pressure" className="text-xs">
                {t('explain.high_pressure')}
              </Threshold>
            ) : (
              <span className="text-xs text-fg-3">{t('explain.not_high')}</span>
            )}
          </p>
        </div>
        <div className={cn('rounded-md border p-2', low ? 'border-dashed border-[var(--conf-ink)]' : 'border-hair')}>
          <p className="text-xs text-fg-3">{t('explain.confidence')}</p>
          <div className="mt-0.5">
            <ConfidenceIndicator value={e.conf} />
          </div>
        </div>
      </div>
      {e.confNote || low ? <p className="mt-1.5 text-xs text-fg-2">{e.confNote ?? t('explain.low_conf_generic')}</p> : null}
    </>
  )
}

/** The 0 to 1.5 scale with the band cut-offs marked, so a score is never read as a 0 to 1 ratio. */
function DqScale({ value }: { value: number }) {
  const pct = (v: number) => `${(Math.min(DQ_MAX, Math.max(0, v)) / DQ_MAX) * 100}%`
  const cuts = [BAND_THRESHOLDS.suboptimal, BAND_THRESHOLDS.good, BAND_THRESHOLDS.optimal, DQ_ELEVATED]
  return (
    <div className="mt-2" role="img" aria-label={t('explain.scale_aria', { v: value.toFixed(2), max: DQ_MAX.toFixed(1) })}>
      <div className="relative h-1.5 rounded-full bg-s3">
        <span className="absolute inset-y-0 left-0 rounded-full bg-fg-3" style={{ width: pct(value) }} />
        {cuts.map((c) => (
          <span key={c} aria-hidden className="absolute -top-0.5 h-2.5 w-px bg-fg-4" style={{ left: pct(c) }} />
        ))}
        <span aria-hidden className="absolute -top-1 size-3.5 -translate-x-1/2 rounded-full border-2 border-canvas bg-fg-1" style={{ left: pct(value) }} />
      </div>
      <div aria-hidden className="relative mt-1 h-3 font-mono text-[10px] tabular-nums text-fg-4">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(DQ_ELEVATED) }}>1.0</span>
        <span className="absolute right-0">{DQ_MAX.toFixed(1)}</span>
      </div>
    </div>
  )
}

function Measured({ e }: { e: MatchEvent }) {
  const alts = [...(e.alts ?? [])].sort((a, b) => a.rank - b.rank)
  const vA = e.vA ?? 0
  const vB = e.vB ?? 0
  return (
    <>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {e.band ? <DqBand band={e.band} size="lg" /> : null}
          <span className="text-xs text-fg-3">{t('explain.decision_quality')}</span>
        </div>
        <p className="font-mono text-2xl font-medium tabular-nums text-fg-1" aria-label={`${t('explain.ratio')} ${(e.dq ?? 0).toFixed(2)}`}>
          {(e.dq ?? 0).toFixed(2)}
        </p>
      </div>
      <DqScale value={e.dq ?? 0} />

      <div className="mt-2.5 rounded-md border border-hair bg-canvas px-2.5 py-2">
        <p className="font-mono text-2xs uppercase tracking-wider text-fg-4">{t('explain.working')}</p>
        <p className="mt-0.5 font-mono text-[12.5px] tabular-nums text-fg-1">V(at arrival) ÷ V(best at release)</p>
        <p className="font-mono text-[12.5px] tabular-nums text-fg-2">
          = {vA.toFixed(2)} ÷ {vB.toFixed(2)} = {(e.dq ?? 0).toFixed(2)}
        </p>
        {(e.dq ?? 0) >= DQ_ELEVATED ? <p className="mt-1.5 text-xs text-fg-2">{t('explain.elevated')}</p> : null}
      </div>

      <div className="mt-2.5">
        <p className="font-mono text-2xs uppercase tracking-wider text-fg-4">{t('explain.alternatives')}</p>
        <table className="mt-1 w-full text-xs">
          <thead>
            <tr className="text-left text-fg-3">
              <th className="w-6 py-0.5 font-medium">{t('explain.col_rank')}</th>
              <th className="py-0.5 font-medium">{t('explain.col_option')}</th>
              <th className="py-0.5 text-right font-medium">V</th>
              <th className="py-0.5 text-right font-medium">p</th>
              <th className="py-0.5 text-right font-medium">V × p</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {alts.map((a) => (
              <tr key={a.rank} className={cn('border-t border-hair', a.chosen && 'bg-s2')}>
                <td className="py-1 font-mono text-fg-2">{a.rank}</td>
                <td className="py-1 text-fg-1">
                  {a.label}
                  {a.chosen ? <span className="ml-1.5 rounded-[2px] border border-highlight px-1 text-2xs text-fg-1">{t('explain.played')}</span> : null}
                </td>
                <td className="py-1 text-right font-mono">{a.v.toFixed(2)}</td>
                <td className="py-1 text-right font-mono">{a.p.toFixed(2)}</td>
                <td className="py-1 text-right font-mono">{a.s.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Tiles e={e} />
    </>
  )
}

function EventOnly({ e }: { e: MatchEvent }) {
  return (
    <>
      <div className="mt-3 rounded-md border border-dashed border-hair-strong p-2.5 pattern-rule">
        <p className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider text-fg-2">
          <TriangleAlert className="size-3" aria-hidden />
          {t('explain.eo_label')}
        </p>
        <div className="mt-2">{e.est ? <EstimateBand lo={e.est.lo} hi={e.est.hi} size="lg" /> : null}</div>
        <p className="mt-2 text-xs text-fg-2">{t('explain.eo_body')}</p>
        <p className="mt-1.5 text-xs text-fg-3">
          <Threshold id="event_only" />
        </p>
      </div>
      <div className="mt-3 rounded-md border border-hair bg-canvas p-2.5">
        <p className="font-mono text-2xs uppercase tracking-wider text-fg-4">{t('explain.working')}</p>
        <p className="mt-1 text-xs text-fg-2">{t('explain.eo_inputs')}</p>
        <p className="mt-1 text-xs text-fg-3">{t('explain.eo_no_alts')}</p>
      </div>
      <dl className="mt-2">
        <Row label={t('explain.pressure_tag')}>
          <span className="font-mono tabular-nums">{e.press.toFixed(2)}</span>
        </Row>
      </dl>
      <Confidence e={e} />
    </>
  )
}

function Run({ e }: { e: MatchEvent }) {
  return (
    <>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="font-mono text-2xs uppercase tracking-wider text-fg-4">{t('explain.ovm')}</p>
          <p className="mt-1 text-sm text-fg-2">{t('explain.ovm_sub')}</p>
        </div>
        <p className="font-mono text-2xl font-medium tabular-nums text-fg-1">+{(e.ovm ?? 0).toFixed(2)}</p>
      </div>
      <div className="mt-3 rounded-md border border-hair bg-canvas p-2.5">
        <p className="font-mono text-2xs uppercase tracking-wider text-fg-4">{t('explain.working')}</p>
        <p className="mt-1 font-mono text-[13px] tabular-nums text-fg-1">
          V(end) − V(start) = {(e.ovmTo ?? 0).toFixed(2)} − {(e.ovmFrom ?? 0).toFixed(2)}
        </p>
        <p className="font-mono text-[13px] tabular-nums text-fg-2">= +{(e.ovm ?? 0).toFixed(2)}</p>
      </div>
      <p className="mt-2 text-xs text-fg-3">
        <Threshold id="value_surface" />
      </p>
      <Confidence e={e} />
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
      <p className="mt-3 rounded-md border border-hair p-2.5 text-xs text-fg-2">{t('explain.effort_note')}</p>
      <Confidence e={e} />
    </>
  )
}

function Simple({ e }: { e: MatchEvent }) {
  return (
    <>
      <dl className="mt-3 divide-y divide-[var(--hairline)]">
        <Row label={t('explain.outcome')}>{t(`outcome.${e.outcome}`)}</Row>
        <Pressure e={e} />
      </dl>
      <p className="mt-2 text-xs text-fg-3">{e.type === 'shot' ? t('explain.shot_note') : t('explain.def_note')}</p>
      <Confidence e={e} />
    </>
  )
}

function HowContent() {
  return (
    <Collapsible.Content className="mt-2 flex flex-col gap-1.5 border-t border-hair pt-2 text-xs text-fg-2">
      <p>{t('explain.how_1')}</p>
      <p>{t('explain.how_2')}</p>
      <p>
        {t('explain.how_3')} <Threshold id="decision_quality" /> <Threshold id="ring" />
      </p>
    </Collapsible.Content>
  )
}

export function ExplainCard({ event, htAt, onPlayFrom, onCopy }: { event: MatchEvent | null; htAt: number; onPlayFrom: (e: MatchEvent) => void; onCopy: (e: MatchEvent) => void }) {
  const [how, setHow] = useState(false)
  if (!event) {
    return (
      <section aria-label={t('explain.title')} className="rounded-lg border border-dashed border-hair-strong p-4">
        <p className="text-sm font-medium text-fg-1">{t('explain.empty_title')}</p>
        <p className="mt-1 text-sm text-fg-3">{t('explain.empty_body')}</p>
      </section>
    )
  }
  const e = event
  const measured = !e.est && !!e.band
  return (
    <section aria-label={t('explain.title')} aria-live="polite" className={cn('rounded-lg border bg-s1 p-3.5', e.est ? 'border-dashed border-hair-strong' : 'border-hair-strong')}>
      <Head e={e} htAt={htAt} />
      {e.est ? <EventOnly e={e} /> : e.band ? <Measured e={e} /> : e.type === 'run' ? <Run e={e} /> : e.type === 'effort' ? <Effort e={e} /> : <Simple e={e} />}
      <Collapsible.Root open={how} onOpenChange={setHow} className="mt-3 border-t border-hair pt-2.5">
        <div className="flex items-center gap-2">
          {measured ? (
            <Collapsible.Trigger className="flex items-center gap-1 whitespace-nowrap text-xs text-accent-text hover:underline">
              <ChevronDown className={cn('size-3 transition-transform', how && 'rotate-180')} aria-hidden />
              {t('explain.how')}
            </Collapsible.Trigger>
          ) : null}
          <div className="ml-auto flex items-center gap-1.5">
            <Tooltip content={t('explain.video_later')}>
              <span tabIndex={0} className="rounded-md">
                <Button size="icon-sm" variant="ghost" disabled aria-label={t('explain.video')}>
                  <Video className="size-3.5" aria-hidden />
                </Button>
              </span>
            </Tooltip>
            <Button size="sm" variant="primary" onClick={() => onPlayFrom(e)}>
              <Play className="size-3 fill-current" aria-hidden />
              {t('explain.play_from')}
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={t('explain.copy_link')} onClick={() => onCopy(e)}>
              <Copy className="size-3.5" aria-hidden />
            </Button>
          </div>
        </div>
        {measured ? <HowContent /> : null}
      </Collapsible.Root>
    </section>
  )
}
