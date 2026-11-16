import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'
import { ChevronLeft, Lock, Loader2, Clock, TriangleAlert, RefreshCw, Upload, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { useAsync } from '@/lib/useAsync'
import { getMatch, parityFor } from '@/api'
import { FAMILIES, PROCESSING_STAGES, type Match } from '@/lib/types'
import { fmtDate } from '@/lib/format'
import { PROVIDER_NAME, KIND_KEY } from '@/lib/providers'
import { ParitySummary, Tag, TierBadge } from '@/components/ui/badges'
import { Skeleton, StageList, EmptyState, InlineAlert } from '@/components/ui/feedback'
import { Button, buttonStyles } from '@/components/ui/button'
import { useApp } from '@/state/app'

export interface MatchCtx {
  match: Match
}
export const useMatch = () => useOutletContext<MatchCtx>().match

export function parityStates(m: Match) {
  const r = parityFor(m)
  return FAMILIES.flatMap((f) => f.metrics.map((id) => r.metrics[id].state))
}

function SourceTags({ match }: { match: Match }) {
  return (
    <span className="flex items-center gap-1.5">
      {match.sources.map((s, i) => (
        <Tag key={i} className="gap-1.5">
          <span className="text-fg-1">{PROVIDER_NAME[s.provider]}</span>
          <span className="text-fg-3">{t(KIND_KEY[s.kind])}</span>
        </Tag>
      ))}
    </span>
  )
}

function ProcessingPanel({ match }: { match: Match }) {
  const [p, setP] = useState(match.stageProgress ?? 0.3)
  useEffect(() => {
    if (match.status !== 'processing') return
    const id = setInterval(() => setP((v) => (v > 0.94 ? 0.35 : v + 0.03)), 700)
    return () => clearInterval(id)
  }, [match.status])
  const stages = PROCESSING_STAGES.map((s) => t(`stage.${s}`))
  return (
    <div className="mx-auto max-w-xl px-6 py-14">
      <div className="rounded-xl bg-s1 p-6">
        <div className="mb-5 flex items-center gap-2.5">
          {match.status === 'processing' ? <Loader2 className="size-4 animate-spin-slow text-accent-text" aria-hidden /> : <Clock className="size-4 text-fg-3" aria-hidden />}
          <h2 className="text-md font-semibold text-fg-1">{match.status === 'processing' ? t('proc.title_processing') : t('proc.title_queued')}</h2>
        </div>
        <p className="mb-6 text-sm text-fg-3">{match.status === 'processing' ? t('proc.body_processing') : t('proc.body_queued')}</p>
        <StageList stages={stages} current={match.status === 'processing' ? (match.stage ?? 0) : -1} progress={p} />
      </div>
    </div>
  )
}

function IssuePanel({ match }: { match: Match }) {
  const { toast } = useApp()
  const failed = match.status === 'failed'
  return (
    <div className="mx-auto max-w-xl px-6 py-14">
      <InlineAlert tone={failed ? 'danger' : 'warn'} icon={failed ? <XCircle className="size-4" /> : <TriangleAlert className="size-4" />} title={failed ? t('proc.failed_title') : t('proc.attention_title')}>
        <p>{match.issue}</p>
      </InlineAlert>
      <div className="mt-5 rounded-xl bg-s1 p-5">
        <h3 className="text-sm font-medium text-fg-1">{t('proc.what_next')}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-fg-2">
          <li>{failed ? t('proc.next_failed_1') : t('proc.next_attention_1')}</li>
          <li>{failed ? t('proc.next_failed_2') : t('proc.next_attention_2')}</li>
        </ul>
        <div className="mt-5 flex gap-2">
          <Link to="/matches/new" className={buttonStyles({ variant: 'primary' })}>
            <Upload className="size-3.5" aria-hidden />
            {t('proc.upload_replacement')}
          </Link>
          <Button onClick={() => toast({ title: t('lib.toast_reprocess'), body: `${match.home} v ${match.away}` })}>
            <RefreshCw className="size-3.5" aria-hidden />
            {t('lib.reprocess')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function LockedPanel({ match, what }: { match: Match; what: string }) {
  return (
    <EmptyState
      icon={<Lock className="size-5" aria-hidden />}
      title={t('locked.title', { what })}
      body={t(match.tier === 2 ? 'locked.body_t2' : 'locked.body_t3')}
      actions={
        <Link to={`/matches/${match.id}/parity`} className={buttonStyles({ variant: 'secondary' })}>
          {t('locked.view_parity')}
        </Link>
      }
    />
  )
}

export function MatchLayout() {
  const { id = '' } = useParams()
  const { data: match, loading } = useAsync(() => getMatch(id), [id])
  if (loading && !match) {
    return (
      <div className="p-5">
        <Skeleton className="mb-4 h-8 w-96" />
        <Skeleton className="h-[480px] w-full" />
      </div>
    )
  }
  if (!match) return <EmptyState title={t('match.not_found')} body={t('match.not_found_body')} actions={<Link to="/matches" className={buttonStyles()}>{t('notfound.back')}</Link>} />
  const states = parityStates(match)
  const summary = parityFor(match).summary
  const ready = match.status === 'ready'
  const tabs = [
    { to: `/matches/${match.id}/parity`, label: t('match.tab_parity') },
    { to: `/matches/${match.id}/brief`, label: t('match.tab_brief') },
    { to: `/matches/${match.id}/replay`, label: t('match.tab_replay') },
    { to: `/ask?match=${match.id}`, label: t('match.tab_ask'), external: true },
  ]
  const onReplayNote = null
  void onReplayNote
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-[52px] shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-hair bg-canvas px-5">
        <Link to="/matches" aria-label={t('match.back')} className="-ml-1 flex size-6 items-center justify-center rounded-sm text-fg-3 hover:bg-s2 hover:text-fg-1">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-fg-1">
            {match.home}
            <span className="mx-1.5 font-normal text-fg-3">{match.score ? `${match.score[0]}–${match.score[1]}` : 'v'}</span>
            {match.away}
          </h1>
          <p className="truncate text-xs text-fg-3">
            {match.competition} · {fmtDate(match.date)}
          </p>
        </div>
        <div className="hidden items-center gap-2 xl:flex">
          <SourceTags match={match} />
          <TierBadge tier={match.tier} status={match.tierStatus} />
          {ready ? <ParitySummary summary={summary} states={states} compact /> : null}
        </div>
        <nav aria-label={t('match.sections')} className="ml-auto flex h-[52px] items-end gap-1">
          {tabs.map((tb) => (
            <NavLink
              key={tb.to}
              to={tb.to}
              className={({ isActive }) =>
                cn(
                  'inline-flex h-10 items-center border-b-2 px-2.5 text-sm transition-colors duration-[var(--dur-base)]',
                  isActive && !(tb as { external?: boolean }).external ? 'border-accent text-fg-1' : 'border-transparent text-fg-3 hover:text-fg-1',
                )
              }
            >
              {tb.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {match.status === 'processing' || match.status === 'queued' ? <ProcessingPanel match={match} /> : match.status === 'failed' || match.status === 'needs_attention' ? <IssuePanel match={match} /> : <Outlet context={{ match } satisfies MatchCtx} />}
      </div>
    </div>
  )
}
