import { useState } from 'react'
import { ChevronDown, Printer } from 'lucide-react'
import { t } from '@/i18n'
import { cn } from '@/lib/cn'
import { BAND_THRESHOLDS, DQ_ELEVATED, DQ_MAX } from '@/lib/bands'
import { PITCH_L, PITCH_W } from '@/lib/engine'
import { PITCH_PATHS } from '@/lib/pitch'
import type { Band } from '@/lib/types'
import { DqBand, ParityBadge, ParityIcon } from '@/components/ui/badges'
import { Button } from '@/components/ui/button'
import type { MatchPagePayload, Moment, State } from './types'

/**
 * The shareable match page: a read-only, light, single-file page built from one payload.
 * It is the concierge deliverable before the AI layer exists, so it carries no generated
 * prose: the data check, coverage, rule-selected moments and optional founder notes.
 * Player references are pseudonymous codes; names are never in the payload.
 */

const pct = (v: number | null | undefined) => (v === null || v === undefined ? t('common.not_applicable') : `${(v * 100).toFixed(1)}%`)
const num = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '–' : v.toFixed(d))
const ref = (r: string | null | undefined) => (r ? r.replace('home_', 'Home ').replace('away_', 'Away ') : '–')
const zone = (z: string | null) => (z ? z.replace(/_/g, ' ') : '–')

function actionLabel(m: Moment) {
  const kind = t(`mp.action_${m.action_type}`)
  if (m.action_type === 'pass' && m.target_player_ref) return `${kind}, ${ref(m.actor_player_ref)} ${t('event.to')} ${ref(m.target_player_ref)}`
  return `${kind}, ${ref(m.actor_player_ref)}`
}

function Scale({ value }: { value: number }) {
  const p = (v: number) => `${(Math.min(DQ_MAX, Math.max(0, v)) / DQ_MAX) * 100}%`
  return (
    <div className="mt-1.5" role="img" aria-label={t('explain.scale_aria', { v: value.toFixed(2), max: DQ_MAX.toFixed(1) })}>
      <div className="relative h-1.5 rounded-full bg-s3">
        <span className="absolute inset-y-0 left-0 rounded-full bg-fg-3" style={{ width: p(value) }} />
        {[BAND_THRESHOLDS.suboptimal, BAND_THRESHOLDS.good, BAND_THRESHOLDS.optimal, DQ_ELEVATED].map((c) => (
          <span key={c} aria-hidden className="absolute -top-0.5 h-2.5 w-px bg-fg-4" style={{ left: p(c) }} />
        ))}
      </div>
      <div aria-hidden className="relative mt-0.5 h-3 font-mono text-[10px] text-fg-4">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: p(DQ_ELEVATED) }}>1.0</span>
        <span className="absolute right-0">1.5</span>
      </div>
    </div>
  )
}

/** Static drawing of the moment: players at the start frame, the ball, and the action's path. */
function Snapshot({ m, pitch }: { m: Moment; pitch: { length_m: number; width_m: number } }) {
  const s = m.snapshot
  if (!s) return <p className="text-xs text-fg-3">{t('mp.no_snapshot')}</p>
  const X = (x: number) => (x + pitch.length_m / 2) * (PITCH_L / pitch.length_m)
  const Y = (y: number) => (pitch.width_m / 2 - y) * (PITCH_W / pitch.width_m)
  return (
    <svg viewBox={`-3 -3 ${PITCH_L + 6} ${PITCH_W + 6}`} className="block w-full rounded-sm" role="img" aria-label={`${actionLabel(m)}, ${m.minute_display}`}>
      <rect x="-3" y="-3" width={PITCH_L + 6} height={PITCH_W + 6} style={{ fill: 'var(--pitch)' }} />
      {PITCH_PATHS.map((d, i) => (
        <path key={i} d={d} fill="none" style={{ stroke: 'var(--pitch-line)' }} strokeWidth={0.5} />
      ))}
      {s.start && s.end ? <line x1={X(s.start.x)} y1={Y(s.start.y)} x2={X(s.end.x)} y2={Y(s.end.y)} style={{ stroke: 'var(--highlight)' }} strokeWidth={1.1} strokeLinecap="round" /> : null}
      {s.players.map((p) => (
        <g key={p.ref}>
          <circle cx={X(p.x)} cy={Y(p.y)} r={p.ref === m.actor_player_ref ? 2.6 : 1.9} style={{ fill: p.team === 'home' ? 'var(--team-home)' : 'var(--team-away)', stroke: p.ref === m.actor_player_ref ? 'var(--highlight)' : 'var(--pitch)' }} strokeWidth={p.ref === m.actor_player_ref ? 0.8 : 0.4} />
        </g>
      ))}
      {s.ball ? <circle cx={X(s.ball.x)} cy={Y(s.ball.y)} r={1.1} style={{ fill: '#ffffff' }} /> : null}
    </svg>
  )
}

function MomentRow({ m, pitch, index }: { m: Moment; pitch: MatchPagePayload['match']['pitch']; index: number }) {
  const [open, setOpen] = useState(false)
  const band = m.dq_band && m.dq_band !== 'not_scored' ? (m.dq_band as Band) : null
  return (
    <li className="avoid-break border-b border-hair">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 py-2 text-left hover:bg-s2/50">
        <span className="w-7 font-mono text-2xs text-fg-4">[{index}]</span>
        <span className="w-12 font-mono text-xs tabular-nums text-fg-1">{m.minute_display}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-fg-1">{actionLabel(m)}{m.action_outcome === 'lost' ? `, ${t('mp.lost')}` : ''}</span>
        {band ? <DqBand band={band} size="sm" /> : m.movement_value !== null ? <span className="font-mono text-xs text-fg-2">{t('mp.movement_value', { v: num(m.movement_value, 3) })}</span> : null}
        <ChevronDown className={cn('size-3.5 shrink-0 text-fg-3 transition-transform no-print', open && 'rotate-180')} aria-hidden />
      </button>
      <div className={cn('grid grid-cols-[240px_1fr] gap-5 pb-3 pl-10', open ? 'grid' : 'hidden print:grid')}>
        <Snapshot m={m} pitch={pitch} />
        <dl className="grid grid-cols-[150px_1fr] content-start gap-y-1 text-xs">
          {m.dq_score !== null ? (
            <>
              <dt className="text-fg-3">{t('mp.dq')}</dt>
              <dd className="text-fg-1">
                <span className="font-mono tabular-nums">{num(m.dq_score)}</span>
                <Scale value={m.dq_score} />
              </dd>
            </>
          ) : null}
          {m.best_option_player_ref ? (
            <>
              <dt className="text-fg-3">{t('mp.options')}</dt>
              <dd className="font-mono tabular-nums text-fg-1">{t('mp.options_value', { chosen: num(m.chosen_option_pov, 3), best: num(m.best_option_pov, 3), who: ref(m.best_option_player_ref) })}</dd>
            </>
          ) : null}
          {m.inferred_intended_ref ? (
            <>
              <dt className="text-fg-3">{t('mp.intended')}</dt>
              <dd className="text-fg-1">{ref(m.inferred_intended_ref)} ({m.inference_confidence})</dd>
            </>
          ) : null}
          <dt className="text-fg-3">{t('mp.pressure')}</dt>
          <dd className="font-mono tabular-nums text-fg-1">{m.opposition_pressure === null ? '–' : t('mp.pressure_value', { v: num(m.opposition_pressure, 1) })}</dd>
          <dt className="text-fg-3">{t('mp.value_change')}</dt>
          <dd className="font-mono tabular-nums text-fg-1">{num(m.xt_delta, 4)}</dd>
          <dt className="text-fg-3">{t('mp.zone')}</dt>
          <dd className="text-fg-1">{zone(m.pitch_zone)}</dd>
          <dt className="text-fg-3">{t('mp.tracking')}</dt>
          <dd className="text-fg-1">{t('mp.tracking_value', { n: m.players_observed ?? '–', ball: m.ball_detected ? t('mp.ball_yes') : t('mp.ball_no') })}</dd>
          <dt className="text-fg-3">{t('mp.ref')}</dt>
          <dd className="font-mono text-fg-3">{m.event_id}</dd>
        </dl>
      </div>
    </li>
  )
}

export function MatchPage({ payload }: { payload: MatchPagePayload }) {
  const p = payload
  const metrics = Object.entries(p.data_check.metrics)
  let counter = 0
  return (
    <div data-theme="print" className="min-h-full bg-desk py-6 print:bg-white print:py-0" style={{ color: 'var(--fg-1)' }}>
      <div className="no-print mx-auto mb-4 flex w-[860px] justify-end">
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="size-3.5" aria-hidden />
          {t('print.print')}
        </Button>
      </div>
      <main className="print-page mx-auto w-[860px] bg-canvas px-[56px] py-[48px] shadow-[0_0_0_1px_var(--hairline)]">
        <header className="flex items-center justify-between border-b border-hair pb-4">
          <span className="text-lg font-semibold tracking-tight text-fg-1">Ponta</span>
          {p.sample_data ? <span className="text-xs font-medium text-fg-4">{t('mp.sample')}</span> : null}
        </header>

        <section className="mt-6">
          <p className="text-xs font-medium text-fg-3">{t('mp.kicker')}</p>
          <h1 className="mt-1 text-2xl font-semibold text-fg-1">{t('mp.title', { home: p.match.home, away: p.match.away })}</h1>
          <p className="mt-1 text-sm text-fg-3">
            {t('mp.meta', { provider: p.match.provider, id: p.match.match_id, min: p.match.duration_min.toFixed(0), hz: p.match.sample_rate_hz })}
          </p>
          <p className="mt-3 rounded-md border border-hair bg-s1 px-3 py-2 text-sm text-fg-2">{p.statement}</p>
        </section>

        <section className="avoid-break mt-7" aria-labelledby="dc">
          <div className="flex items-end justify-between">
            <h2 id="dc" className="text-md font-semibold text-fg-1">{t('mp.data_check')}</h2>
            <span className="flex items-center gap-3 text-xs text-fg-2">
              {(['full', 'degraded', 'blocked'] as State[]).map((k) => (
                <span key={k} className={cn('inline-flex items-center gap-1', k === 'blocked' ? 'text-parity-dim' : 'text-parity')}>
                  <ParityIcon state={k} size={11} />
                  <span className="text-fg-2">{t(`parity.count_${k}`, { n: p.data_check.summary[k] })}</span>
                </span>
              ))}
            </span>
          </div>
          <table className="mt-3 w-full border-collapse text-xs">
            <tbody>
              {metrics.map(([id, mc]) => (
                <tr key={id} className="border-b border-hair align-top">
                  <td className="w-[190px] py-1.5 pr-3 font-medium text-fg-1">{mc.label}</td>
                  <td className="w-[96px] py-1.5 pr-3"><ParityBadge state={mc.state} size="sm" className="!px-1.5 [&>span]:not-sr-only" /></td>
                  <td className="py-1.5 text-fg-2">
                    {mc.reason}
                    {mc.measure ? <span className="ml-1.5 font-mono text-fg-3">[{mc.measure}]</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="avoid-break mt-7" aria-labelledby="cov">
          <h2 id="cov" className="text-md font-semibold text-fg-1">{t('mp.coverage')}</h2>
          <p className="mt-1 text-sm text-fg-2">
            {t('mp.coverage_line', { scored: p.coverage.decisions_scored, total: p.coverage.decisions_total, share: pct(p.coverage.scored_share) })}
          </p>
          <dl className="mt-2 grid grid-cols-[260px_1fr] gap-y-1 text-xs">
            <dt className="text-fg-3">{t('mp.cause_goalkeeper')}</dt>
            <dd className="font-mono tabular-nums">{p.coverage.not_scored_causes.goalkeeper ?? 0}</dd>
            <dt className="text-fg-3">{t('mp.cause_set_piece')}</dt>
            <dd className="font-mono tabular-nums">{p.coverage.not_scored_causes.set_piece ?? 0}</dd>
            <dt className="text-fg-3">{t('mp.cause_engine')}</dt>
            <dd className="font-mono tabular-nums">{p.coverage.not_scored_causes.no_score_from_engine ?? 0}</dd>
            <dt className="text-fg-3">{t('mp.ball_share')}</dt>
            <dd className="font-mono tabular-nums">{pct(p.coverage.ball_detected_share)}</dd>
            <dt className="text-fg-3">{t('mp.player_share')}</dt>
            <dd className="font-mono tabular-nums">{pct(p.coverage.player_observation_share)}</dd>
          </dl>
        </section>

        {p.moment_groups.map((g) => (
          <section key={g.id} className="mt-7" aria-labelledby={`g-${g.id}`}>
            <h2 id={`g-${g.id}`} className="text-md font-semibold text-fg-1">{g.title}</h2>
            <p className="mt-0.5 text-xs text-fg-3">{t('mp.rule', { rule: g.rule })}</p>
            {g.moments.length ? (
              <ul className="mt-2 border-t border-hair">
                {g.moments.map((m) => (
                  <MomentRow key={m.event_id} m={m} pitch={p.match.pitch} index={++counter} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-fg-3">{t('mp.none')}</p>
            )}
          </section>
        ))}

        {p.notes.length ? (
          <section className="avoid-break mt-7" aria-labelledby="notes">
            <h2 id="notes" className="text-md font-semibold text-fg-1">{t('mp.notes')}</h2>
            <p className="mt-0.5 text-xs text-fg-3">{t('mp.notes_sub')}</p>
            {p.notes.map((n, i) => (
              <p key={i} className="mt-2 text-sm text-fg-1">{n}</p>
            ))}
          </section>
        ) : null}

        <footer className="mt-8 border-t border-hair pt-3 text-2xs text-fg-4">
          {t('mp.footer', { engine: p.engine_version, schema: p.schema_version, at: p.generated_at })}
        </footer>
      </main>
    </div>
  )
}
