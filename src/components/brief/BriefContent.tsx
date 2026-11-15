import { Link } from 'react-router-dom'
import { Info, MessageSquarePlus, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { FAMILIES, type Brief, type Match, type MatchEvent, type MetricId } from '@/lib/types'
import { parityFor } from '@/api'
import type { LoadedPack } from '@/api/packs'
import { fmtDate, fmtDateTime } from '@/lib/format'
import { confLevel } from '@/lib/bands'
import { AiMarker, ConfidenceGlyph, ParityIcon, TierBadge } from '@/components/ui/badges'
import { CitationChip } from '@/components/ui/moment'
import { PROVIDER_NAME } from '@/lib/providers'

export function degradedBlockedLines(match: Match) {
  const r = parityFor(match)
  const ids = FAMILIES.flatMap((f) => f.metrics)
  const pick = (s: 'degraded' | 'blocked') => ids.filter((id) => r.metrics[id].state === s)
  return { degraded: pick('degraded') as MetricId[], blocked: pick('blocked') as MetricId[], summary: r.summary }
}

function LimitationLine({ state, ids }: { state: 'degraded' | 'blocked'; ids: MetricId[] }) {
  if (!ids.length) return null
  return (
    <p className="flex items-start gap-2 text-sm leading-5">
      <span className={cn('inline-flex w-[84px] shrink-0 items-center gap-1.5 font-medium', state === 'degraded' ? 'text-parity' : 'text-parity-dim')}>
        <ParityIcon state={state} size={12} />
        {t(`parity.${state}`)}
      </span>
      <span className="text-fg-2">{ids.map((id) => t(`metric.${id}`)).join(', ')}</span>
    </p>
  )
}

export function BriefHeader({ match, brief, lp, variant, regenerating }: { match: Match; brief: Brief; lp: LoadedPack; variant: 'screen' | 'print'; regenerating?: boolean }) {
  const { degraded, blocked, summary } = degradedBlockedLines(match)
  const eventOnly = lp.eventOnly
  const lowSource = (match.ingest.occludedPct ?? 0) > 5
  return (
    <header>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-2xs uppercase tracking-wider text-fg-3">{t('brief.kicker')}</span>
        <AiMarker tone={variant === 'print' ? 'print' : 'dark'} />
      </div>

      <div className="mt-4 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-9 text-fg-1">
            {match.home}
            <span className="mx-2.5 inline-block translate-y-[-1px] rounded-md bg-s3 px-2 py-0.5 font-mono text-xl font-medium tabular-nums">{match.score ? `${match.score[0]}–${match.score[1]}` : 'v'}</span>
            {match.away}
          </h1>
          <p className="mt-1.5 text-sm text-fg-3">
            {match.competition} · {fmtDate(match.date)} · {match.sources.map((s) => PROVIDER_NAME[s.provider]).join(' + ')}
          </p>
        </div>
        <TierBadge tier={match.tier} status={match.tierStatus} size="lg" className="shrink-0" />
      </div>

      <section aria-label={t('brief.data_panel')} className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-hair-strong bg-s2">
        <div className="border-r border-hair px-5 py-4">
          <p className="font-mono text-2xs uppercase tracking-wider text-fg-4">{t('brief.parity_label')}</p>
          <div className="mt-2.5 flex items-start gap-6">
            {(['full', 'degraded', 'blocked'] as const).map((s) => (
              <div key={s} className={cn(s === 'blocked' ? 'text-parity-dim' : 'text-parity')}>
                <p className="font-mono text-xl font-medium leading-6 tabular-nums text-fg-1">{summary[s]}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs">
                  <ParityIcon state={s} size={12} />
                  {t(`parity.${s}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="font-mono text-2xs uppercase tracking-wider text-fg-4">{t('brief.limits_label')}</p>
          <div className="mt-2.5 flex flex-col gap-2">
            <LimitationLine state="degraded" ids={degraded} />
            <LimitationLine state="blocked" ids={blocked} />
            {!degraded.length && !blocked.length ? <p className="text-sm text-fg-2">{t('brief.limits_none')}</p> : null}
          </div>
        </div>
      </section>

      {eventOnly ? (
        <div className="mt-4 rounded-md border border-dashed border-hair-strong p-3.5 pattern-rule">
          <p className="flex items-start gap-2 text-sm text-fg-1">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-fg-2" aria-hidden />
            <span>
              <span className="font-medium">{t('brief.eventonly_title')}</span> {t('brief.eventonly_body')}
            </span>
          </p>
        </div>
      ) : lowSource ? (
        <div className="mt-4 rounded-md border border-dashed border-[var(--conf-ink)] p-3.5">
          <p className="flex items-start gap-2 text-sm text-fg-1">
            <ConfidenceGlyph value={0.5} size={14} />
            <span>
              <span className="font-medium">{t('brief.lowconf_title')}</span> {t('brief.lowconf_body', { pct: match.ingest.occludedPct ?? 0 })}
            </span>
          </p>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-fg-4">
        {t('brief.generated', { model: brief.model, when: fmtDateTime(brief.generatedAt) })}
        {regenerating ? <span className="ml-2 text-accent-text">{t('brief.regenerating')}</span> : null}
      </p>
    </header>
  )
}

function Bullet({ text, ids, lp, matchId, variant, refs, onAsk }: { text: string; ids: string[]; lp: LoadedPack; matchId: string; variant: 'screen' | 'print'; refs: Map<string, number>; onAsk?: () => void }) {
  const events = ids.map((id) => lp.byId.get(id)).filter(Boolean) as MatchEvent[]
  const low = events.filter((e) => confLevel(e.conf) === 'low')
  return (
    <li className="avoid-break py-4 first:pt-0 last:pb-0">
      <p className="max-w-[74ch] text-[15px] leading-6 text-fg-1">{text}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {events.map((e) => (
          <CitationChip key={e.id} event={e} matchId={matchId} engine={variant === 'screen' ? lp.engine : undefined} index={variant === 'print' ? refs.get(e.id) : undefined} variant={variant === 'print' ? 'print' : 'dark'} />
        ))}
        {variant === 'screen' && onAsk ? (
          <button onClick={onAsk} className="ml-auto inline-flex h-[22px] items-center gap-1 rounded-sm px-1.5 text-xs text-fg-3 hover:bg-s2 hover:text-fg-1">
            <MessageSquarePlus className="size-3" aria-hidden />
            {t('brief.ask_about')}
          </button>
        ) : null}
      </div>
      {low.length ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-fg-3">
          <ConfidenceGlyph value={low[0].conf} size={10} />
          {t('brief.low_note', { v: low[0].conf.toFixed(2) })}
        </p>
      ) : null}
    </li>
  )
}

export function BriefBody({ brief, lp, matchId, variant, onAsk }: { brief: Brief; lp: LoadedPack; matchId: string; variant: 'screen' | 'print'; onAsk?: (text: string, ids: string[]) => void }) {
  const refs = new Map<string, number>()
  let n = 0
  for (const th of brief.themes) for (const b of th.bullets) for (const id of b.citations) if (!refs.has(id)) refs.set(id, ++n)
  return (
    <div className="flex flex-col gap-10">
      {brief.themes.map((th, i) => {
        const moments = new Set(th.bullets.flatMap((b) => b.citations)).size
        return (
          <section key={th.id} aria-labelledby={`th-${th.id}`} className="avoid-break scroll-mt-6">
            <h2 id={`th-${th.id}`} className="flex items-baseline gap-3 border-b border-hair-strong pb-2.5">
              <span aria-hidden className="font-mono text-xs tabular-nums text-fg-4">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-md font-semibold text-fg-1">{th.title}</span>
              <span className="ml-auto text-xs font-normal text-fg-4">{moments === 1 ? t('brief.moment_one') : t('brief.moments_count', { n: moments })}</span>
            </h2>
            <ul className="mt-4 flex flex-col divide-y divide-[var(--hairline)]">
              {th.bullets.map((b) => (
                <Bullet key={b.id} text={b.text} ids={b.citations} lp={lp} matchId={matchId} variant={variant} refs={refs} onAsk={onAsk ? () => onAsk(b.text, b.citations) : undefined} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function BriefLimitations({ brief }: { brief: Brief }) {
  return (
    <section aria-labelledby="lim" className="avoid-break rounded-lg border border-hair bg-s2 px-5 py-4">
      <h2 id="lim" className="flex items-center gap-2 font-mono text-2xs font-medium uppercase tracking-wider text-fg-3">
        <Info className="size-3.5" aria-hidden />
        {t('brief.limitations')}
      </h2>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-4 text-sm leading-5 text-fg-2">
        {brief.limitations.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </section>
  )
}

export function BriefBackLink({ matchId }: { matchId: string }) {
  return (
    <Link to={`/matches/${matchId}/parity`} className="link text-sm">
      {t('brief.view_parity')}
    </Link>
  )
}
