import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { t } from '@/i18n'
import { cn } from '@/lib/cn'
import { useAsync } from '@/lib/useAsync'
import { loadPack } from '@/api/packs'
import { BAND_ORDER } from '@/lib/bands'
import { POSITION_NAME } from '@/lib/engine'
import { MomentCard } from '@/components/ui/moment'
import { InlineAlert, Skeleton } from '@/components/ui/feedback'
import { BandGlyph, Tag, TeamDot } from '@/components/ui/badges'
import type { Band, Team } from '@/lib/types'
import { makeWho, WhoProvider } from '@/lib/names'
import { useApp } from '@/state/app'

export function PlayerProfile() {
  const { id = 'h10' } = useParams()
  const team = (id[0] === 'a' ? 'a' : 'h') as Team
  const num = Number(id.slice(1)) || 10
  const q = useAsync(() => loadPack('m_0412'), [])
  const stats = useMemo(() => {
    if (!q.data) return null
    const mine = q.data.events.filter((e) => e.team === team && e.num === num)
    const passes = mine.filter((e) => e.type === 'pass')
    const bands = { poor: 0, suboptimal: 0, good: 0, optimal: 0 } as Record<Band, number>
    for (const p of passes) if (p.band) bands[p.band]++
    const rated = passes.filter((p) => p.dq !== undefined)
    const best = [...rated].sort((a, b) => (b.dq ?? 0) - (a.dq ?? 0)).slice(0, 3)
    const low = [...rated].filter((p) => p.conf >= 0.75).sort((a, b) => (a.dq ?? 0) - (b.dq ?? 0)).slice(0, 3)
    return { n: mine.length, passes: passes.length, carries: mine.filter((e) => e.type === 'carry').length, runs: mine.filter((e) => e.type === 'run').length, bands, ratedN: rated.length, best, low, dist: q.data.engine.distanceAt(team, num, q.data.data.duration) }
  }, [q.data, team, num])
  const { nameMode } = useApp()
  const who = makeWho(q.data?.match, nameMode)
  return (
    <WhoProvider match={q.data?.match}>
    <div className="mx-auto max-w-[960px] px-8 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2.5 font-serif text-[30px] font-normal leading-9 tracking-tight text-fg-1">
          <TeamDot team={team} size={12} />
          <span className="min-w-0 truncate">{who(team, num)}</span>
        </h1>
        <Tag dashed>{t('common.later')}</Tag>
        <span className="text-sm text-fg-3">{POSITION_NAME[team][num] ?? ''}</span>
      </div>
      <InlineAlert className="mt-4" title={t('player.later_title')}>
        {t('player.later_body')}
      </InlineAlert>

      {!stats ? (
        <Skeleton className="mt-6 h-64 w-full" />
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-4 gap-3">
            {[
              [t('player.events'), stats.n],
              [t('player.passes'), stats.passes],
              [t('player.carries'), stats.carries],
              [t('player.runs'), stats.runs],
            ].map(([l, v]) => (
              <div key={l as string} className="flex flex-col-reverse rounded-xl border border-hair bg-s1 px-5 pb-4 pt-5">
                <dt className="mt-3 text-sm font-medium text-fg-1">{l}</dt>
                <dd className="font-mono text-[34px] font-semibold leading-none tracking-tight tabular-nums text-fg-1">{v}</dd>
              </div>
            ))}
          </dl>
          <section className="mt-6 rounded-xl border border-hair bg-s1 p-5" aria-labelledby="dq-dist">
            <h2 id="dq-dist" className="text-md font-semibold text-fg-1">
              {t('player.dq_title')}
            </h2>
            <p className="mt-0.5 text-sm text-fg-3">{t('player.dq_sub', { n: stats.ratedN })}</p>
            <BandColumns bands={stats.bands} />
          </section>
          <section className="mt-6 grid grid-cols-2 gap-6">
            <MomentGroup title={t('player.top')} events={stats.best} lp={q.data!} />
            <MomentGroup title={t('player.review')} events={stats.low} lp={q.data!} />
          </section>
          <section className="mt-6 rounded-xl border border-hair bg-s1 p-5">
            <h2 className="text-md font-semibold text-fg-1">{t('player.physical')}</h2>
            <p className="mt-0.5 text-sm text-fg-3">{t('player.physical_sub')}</p>
            <p className="mt-3 font-mono text-lg tabular-nums text-fg-1">
              {(stats.dist / 1000).toFixed(2)} <span className="text-sm text-fg-3">km</span>
            </p>
          </section>
          <p className="mt-6 text-sm">
            <Link to="/matches/m_0412/replay" className="link">
              {t('player.open_replay')}
            </Link>
          </p>
        </>
      )}
    </div>
    </WhoProvider>
  )
}

function MomentGroup({ title, events, lp }: { title: string; events: import('@/lib/types').MatchEvent[]; lp: import('@/api/packs').LoadedPack }) {
  return (
    <div>
      <h2 className="mb-3 text-md font-semibold text-fg-1">{title}</h2>
      <div className="flex flex-wrap gap-4">
        {events.map((e) => (
          <MomentCard key={e.id} event={e} matchId={lp.match.id} engine={lp.engine} />
        ))}
      </div>
    </div>
  )
}

/**
 * Pass decision quality as columns (reference chart style): one neutral series, the most common
 * band in brand blue, 4px rounded tops on a shared baseline, recessive dashed gridlines, a direct
 * count and share above each column, a tooltip on hover, and a table for screen readers.
 */
function BandColumns({ bands }: { bands: Record<Band, number> }) {
  const [hover, setHover] = useState<Band | null>(null)
  const total = BAND_ORDER.reduce((n, b) => n + bands[b], 0)
  const max = Math.max(1, ...BAND_ORDER.map((b) => bands[b]))
  const top = BAND_ORDER.reduce((a, b) => (bands[b] > bands[a] ? b : a), BAND_ORDER[0])
  const share = (b: Band) => (total ? Math.round((bands[b] / total) * 100) : 0)
  const H = 168
  return (
    <figure className="mt-5">
      <div className="relative" style={{ height: H + 28 }} aria-hidden>
        {/* gridlines at a quarter, half and three quarters of the tallest column */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <span key={f} className="absolute inset-x-0 border-t border-dashed border-hair" style={{ bottom: f * H }} />
        ))}
        <span className="absolute inset-x-0 bottom-0 border-t border-hair-strong" />
        <div className="absolute inset-0 grid grid-cols-4 gap-6 px-6">
          {BAND_ORDER.map((b) => {
            const h = bands[b] ? Math.max(4, (bands[b] / max) * H) : 0
            return (
              <div key={b} className="relative flex flex-col items-center justify-end" onPointerEnter={() => setHover(b)} onPointerLeave={() => setHover(null)}>
                <span className="mb-1.5 text-sm font-medium tabular-nums text-fg-1">
                  {bands[b]}
                  <span className="ml-1 text-xs font-normal text-fg-3">{share(b)}%</span>
                </span>
                <span
                  className={cn('block w-full max-w-[72px] rounded-t-[4px] transition-colors duration-[var(--dur-fast)]', b === top && bands[b] ? 'bg-accent' : hover === b ? 'bg-fg-3' : 'bg-s3')}
                  style={{ height: h }}
                />
                {hover === b ? (
                  <span className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md bg-s3 px-2 py-1 text-xs text-fg-1 shadow-lg">
                    {t('player.dq_tip', { n: bands[b], band: t(`band.${b}`), pct: share(b) })}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-6 px-6" aria-hidden>
        {BAND_ORDER.map((b) => (
          <span key={b} className="flex items-center justify-center gap-1.5 text-sm text-fg-2">
            <BandGlyph band={b} size={13} />
            {t(`band.${b}`)}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 flex items-center gap-2 text-xs text-fg-3">
        <span className="inline-block size-2.5 rounded-[2px] bg-accent" aria-hidden />
        {t('player.dq_top')}
      </figcaption>
      <table className="sr-only">
        <caption>{t('player.dq_title')}</caption>
        <tbody>
          {BAND_ORDER.map((b) => (
            <tr key={b}>
              <th scope="row">{t(`band.${b}`)}</th>
              <td>{bands[b]}</td>
              <td>{share(b)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
