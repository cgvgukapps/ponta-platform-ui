import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { t } from '@/i18n'
import { useAsync } from '@/lib/useAsync'
import { loadPack } from '@/api/packs'
import { BAND_ORDER } from '@/lib/bands'
import { POSITION_NAME } from '@/lib/engine'
import { playerLabel } from '@/lib/events'
import { MomentCard } from '@/components/ui/moment'
import { InlineAlert, Skeleton } from '@/components/ui/feedback'
import { BandGlyph, Tag, TeamDot } from '@/components/ui/badges'
import type { Band, Team } from '@/lib/types'

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
  const maxBand = stats ? Math.max(1, ...BAND_ORDER.map((b) => stats.bands[b])) : 1
  return (
    <div className="mx-auto max-w-[960px] px-8 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2.5 text-xl font-semibold text-fg-1">
          <TeamDot team={team} size={12} />
          {playerLabel(team, num)}
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
              <div key={l as string} className="rounded-xl bg-s1 px-4 py-3">
                <dt className="text-xs text-fg-3">{l}</dt>
                <dd className="mt-1 font-mono text-2xl tabular-nums text-fg-1">{v}</dd>
              </div>
            ))}
          </dl>
          <section className="mt-6 rounded-xl bg-s1 p-5" aria-labelledby="dq-dist">
            <h2 id="dq-dist" className="text-md font-semibold text-fg-1">
              {t('player.dq_title')}
            </h2>
            <p className="mt-0.5 text-sm text-fg-3">{t('player.dq_sub', { n: stats.ratedN })}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {BAND_ORDER.map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <span className="flex w-[120px] items-center gap-2 text-sm text-fg-1">
                    <BandGlyph band={b} size={14} />
                    {t(`band.${b}`)}
                  </span>
                  <span className="h-2 flex-1 rounded-[2px] bg-s3">
                    <span className="block h-full rounded-[2px] bg-fg-3" style={{ width: `${(stats.bands[b] / maxBand) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right font-mono text-sm tabular-nums text-fg-1">{stats.bands[b]}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-6 grid grid-cols-2 gap-6">
            <MomentGroup title={t('player.top')} events={stats.best} lp={q.data!} />
            <MomentGroup title={t('player.review')} events={stats.low} lp={q.data!} />
          </section>
          <section className="mt-6 rounded-xl bg-s1 p-5">
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
