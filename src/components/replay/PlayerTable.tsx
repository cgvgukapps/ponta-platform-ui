import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import type { LoadedPack } from '@/api/packs'
import { SLOTS } from '@/lib/engine'
import { computeControl, makeFields, pressureIndex } from '@/lib/overlay'
import { ParityIcon, TeamDot } from '@/components/ui/badges'
import { Tooltip } from '@/components/ui/overlay'
import { HIGH_PRESSURE } from '@/lib/bands'
import { playerLabel } from '@/lib/events'
import { useClock, type PlaybackStore } from './playback'
import type { Team } from '@/lib/types'

const th = 'sticky top-0 z-10 bg-s1 px-2 py-1.5 text-right text-xs font-medium text-fg-3'

function Blocked({ why }: { why: string }) {
  return (
    <Tooltip content={why}>
      <span className="inline-flex items-center justify-end gap-1 text-fg-4" tabIndex={0}>
        <ParityIcon state="blocked" size={10} />
        <span className="sr-only">{why}</span>
        <span aria-hidden>n/a</span>
      </span>
    </Tooltip>
  )
}

export function PlayerTable({ lp, store, selected, onSelect }: { lp: LoadedPack; store: PlaybackStore; selected: string | null; onSelect: (k: string | null) => void }) {
  const now = useClock(store, 0.2)
  const fields = useMemo(makeFields, [])

  if (lp.eventOnly) return <EventCounts lp={lp} now={now} />

  const frame = lp.engine.frame(now)
  const hasBoth = lp.data.teams.showHome && lp.data.teams.showAway
  if (hasBoth) computeControl(frame.players, fields)
  const rows = frame.players.map((p) => {
    const idx = SLOTS.findIndex((s) => s.team === p.team && s.num === p.num)
    return { p, key: `${p.team}${p.num}`, dist: lp.engine.distanceAt(p.team, p.num, now), press: hasBoth ? pressureIndex(p, frame.players) : null, share: hasBoth ? fields.share[idx] : null }
  })
  const teams: Team[] = ['h', 'a']
  const whyP = t('table.blocked_pressure')
  return (
    <div className="h-full min-h-0 overflow-auto rounded-md border border-hair bg-s1">
      <table className="w-full border-collapse text-sm" aria-label={t('replay.players')}>
        <thead>
          <tr>
            <th className={cn(th, 'text-left')}>{t('table.player')}</th>
            <th className={th}>{t('table.speed')}</th>
            <th className={th}>{t('table.distance')}</th>
            <th className={th}>{t('table.pressure')}</th>
            <th className={th}>{t('table.control')}</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {teams.map((tm) => {
            const trs = rows.filter((r) => r.p.team === tm)
            if (!trs.length) return null
            return [
              <tr key={`h-${tm}`}>
                <td colSpan={5} className="border-y border-hair bg-s2 px-2 py-1 font-sans text-xs font-medium text-fg-2">
                  <span className="inline-flex items-center gap-1.5">
                    <TeamDot team={tm} size={8} />
                    {tm === 'h' ? lp.match.home : lp.match.away}
                  </span>
                </td>
              </tr>,
              ...trs.map(({ p, key, dist, press, share }) => {
                const sel = key === selected
                const holder = lp.engine.ballAt(now).holder === p.num && lp.engine.ballAt(now).team === p.team
                return (
                  <tr key={key} onClick={() => onSelect(sel ? null : key)} className={cn('h-[26px] cursor-pointer border-b border-hair hover:bg-s2', sel && 'bg-s3')}>
                    <td className="px-2 text-left font-sans text-fg-1">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-5 text-right font-mono text-fg-2">{p.num}</span>
                        {tm === 'h' && p.num === 10 ? (
                          <Link to="/players/h10" onClick={(e) => e.stopPropagation()} className="hover:text-accent-text hover:underline">
                            {playerLabel(tm, p.num)}
                          </Link>
                        ) : (
                          <span>{playerLabel(tm, p.num)}</span>
                        )}
                        {holder ? <span className="inline-block size-1.5 rounded-full bg-fg-1" aria-label={t('table.on_ball')} /> : null}
                      </span>
                    </td>
                    <td className="px-2 text-right text-fg-1">{(p.speed * 3.6).toFixed(1)}</td>
                    <td className="px-2 text-right text-fg-1">{(dist / 1000).toFixed(2)}</td>
                    <td className={cn('px-2 text-right', press !== null && press >= HIGH_PRESSURE ? 'text-fg-1 font-medium' : 'text-fg-1')}>{press === null ? <Blocked why={whyP} /> : press.toFixed(2)}</td>
                    <td className="px-2 text-right text-fg-1">{share === null ? <Blocked why={whyP} /> : `${(share * 100).toFixed(1)}%`}</td>
                  </tr>
                )
              }),
            ]
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-fg-4">
        {t('table.units')}
      </p>
    </div>
  )
}

function EventCounts({ lp, now }: { lp: LoadedPack; now: number }) {
  const rows = useMemo(() => {
    const m = new Map<string, { team: Team; num: number; pass: number; lost: number; carry: number }>()
    for (const e of lp.events) {
      if (e.t > now) break
      const key = `${e.team}${e.num}`
      const r = m.get(key) ?? { team: e.team, num: e.num, pass: 0, lost: 0, carry: 0 }
      if (e.type === 'pass') r.pass++
      if (e.type === 'carry') r.carry++
      if (e.outcome === 'lost') r.lost++
      m.set(key, r)
    }
    return [...m.values()].sort((a, b) => (a.team === b.team ? a.num - b.num : a.team === 'h' ? -1 : 1))
  }, [lp, now])
  return (
    <div className="h-full min-h-0 overflow-auto rounded-md border border-hair bg-s1">
      <p className="border-b border-hair px-3 py-2 text-xs text-fg-2">{t('table.eo_note')}</p>
      <table className="w-full border-collapse text-sm" aria-label={t('replay.players')}>
        <thead>
          <tr>
            <th className={cn(th, 'text-left')}>{t('table.player')}</th>
            <th className={th}>{t('table.passes')}</th>
            <th className={th}>{t('table.carries')}</th>
            <th className={th}>{t('table.lost')}</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map((r) => (
            <tr key={`${r.team}${r.num}`} className="h-[26px] border-b border-hair">
              <td className="px-2 text-left font-sans text-fg-1">
                <span className="inline-flex items-center gap-1.5">
                  <TeamDot team={r.team} size={8} />
                  {playerLabel(r.team, r.num)}
                </span>
              </td>
              <td className="px-2 text-right">{r.pass}</td>
              <td className="px-2 text-right">{r.carry}</td>
              <td className="px-2 text-right">{r.lost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
