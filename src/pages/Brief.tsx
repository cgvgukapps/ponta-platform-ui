import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown, FileDown, Link2, MessageSquarePlus, RefreshCw, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { useMatch, LockedPanel } from '@/components/shell/MatchLayout'
import { useAsync } from '@/lib/useAsync'
import { getBrief } from '@/api'
import { loadPack } from '@/api/packs'
import { Button } from '@/components/ui/button'
import { EmptyState, InlineAlert, Skeleton } from '@/components/ui/feedback'
import { BriefBackLink, BriefBody, BriefHeader, BriefLimitations } from '@/components/brief/BriefContent'
import { BAND_ORDER } from '@/lib/bands'
import { ConfidenceGlyph, DqBand, EstimateBand } from '@/components/ui/badges'
import { CitationChip } from '@/components/ui/moment'
import { useApp } from '@/state/app'
import type { MatchEvent } from '@/lib/types'

function HowToRead({ sample, matchId, engine, eventOnly }: { sample?: MatchEvent; matchId: string; engine?: import('@/lib/engine').Engine; eventOnly: boolean }) {
  const [open, setOpen] = useState(false)
  const lowSample = sample ? { ...sample, id: 'evt_00000', conf: 0.58 } : undefined
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="rounded-xl border border-hair bg-s1">
      <Collapsible.Trigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-fg-1">
        {t('brief.how_title')}
        <ChevronDown className={cn('size-4 text-fg-3 transition-transform duration-[var(--dur-base)]', open && 'rotate-180')} aria-hidden />
      </Collapsible.Trigger>
      <Collapsible.Content className="flex flex-col gap-3 border-t border-hair px-4 py-3 text-sm text-fg-2">
        <p>{t('brief.how_cite')}</p>
        <div className="flex flex-wrap items-center gap-2">
          {sample ? <CitationChip event={sample} matchId={matchId} engine={engine} /> : null}
          {lowSample ? <CitationChip event={lowSample} matchId={matchId} engine={engine} /> : null}
        </div>
        <p className="flex items-start gap-2">
          <ConfidenceGlyph value={0.58} size={12} /> <span>{t('brief.how_conf')}</span>
        </p>
        <p>{t('brief.how_bands')}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {BAND_ORDER.map((b) => (
            <DqBand key={b} band={b} />
          ))}
          {eventOnly ? <EstimateBand lo="suboptimal" hi="good" /> : null}
        </div>
        {eventOnly ? <p>{t('brief.how_est')}</p> : null}
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export function BriefPage() {
  const match = useMatch()
  const nav = useNavigate()
  const { toast } = useApp()
  const [regen, setRegen] = useState(false)
  const brief = useAsync(() => getBrief(match.id), [match.id])
  const pack = useAsync(() => (match.pack ? loadPack(match.id) : Promise.reject(new Error('none'))), [match.id])

  if (match.briefStatus === 'locked') return <LockedPanel match={match} what={t('match.tab_brief')} />
  if (match.briefStatus !== 'ready') {
    return (
      <EmptyState
        icon={<Lock className="size-5" aria-hidden />}
        title={match.briefStatus === 'generating' ? t('brief.generating_title') : t('brief.none_title')}
        body={match.briefStatus === 'generating' ? t('brief.generating_body') : t('brief.none_body')}
        actions={<Button variant="primary" onClick={() => toast({ title: t('brief.toast_queued') })}>{t('brief.generate')}</Button>}
      />
    )
  }
  if (brief.loading || pack.loading || !brief.data || !pack.data) {
    return (
      <div className="mx-auto max-w-[960px] px-6 py-8">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-8 w-[520px]" />
        <Skeleton className="mt-6 h-24 w-full" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    )
  }
  const lp = pack.data
  const b = brief.data
  const sample = b.themes[0].bullets[0].citations.map((id) => lp.byId.get(id)).find(Boolean)
  const ask = (q?: string) => nav(`/ask?match=${match.id}${q ? `&q=${encodeURIComponent(q)}` : ''}&from=brief`)
  const jump = (id: string) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(`th-${id}`)?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
  }
  return (
    <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)_272px] items-start gap-8 px-8 py-8">
      <article aria-label={t('brief.kicker')} className="rounded-xl border border-hair bg-s1 px-10 py-9">
        <BriefHeader match={match} brief={b} lp={lp} variant="screen" regenerating={regen} />
        <div className={cn('mt-10 transition-opacity duration-[var(--dur-slow)]', regen && 'opacity-40')}>
          <BriefBody brief={b} lp={lp} matchId={match.id} variant="screen" onAsk={(text) => ask(`Tell me more about this: ${text.split('.')[0]}`)} />
        </div>
        <div className="mt-10">
          <BriefLimitations brief={b} />
          <p className="mt-4 text-xs text-fg-4">
            <BriefBackLink matchId={match.id} />
          </p>
        </div>
      </article>
      <aside className="sticky top-6 flex flex-col gap-3" aria-label={t('brief.actions')}>
        <div className="flex flex-col gap-2 rounded-xl border border-hair bg-s1 p-3">
          <Button variant="primary" onClick={() => nav(`/matches/${match.id}/brief/print`)}>
            <FileDown className="size-3.5" aria-hidden />
            {t('brief.export')}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => toast({ title: t('brief.toast_link'), body: t('brief.toast_link_body') })}>
              <Link2 className="size-3.5" aria-hidden />
              {t('brief.share')}
            </Button>
            <Button
              loading={regen}
              onClick={() => {
                setRegen(true)
                setTimeout(() => {
                  setRegen(false)
                  toast({ title: t('brief.toast_regen'), body: t('brief.toast_regen_body') })
                }, 1600)
              }}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              {t('brief.regenerate')}
            </Button>
          </div>
          <Button variant="ghost" onClick={() => ask()}>
            <MessageSquarePlus className="size-3.5" aria-hidden />
            {t('brief.follow_up')}
          </Button>
        </div>
        <nav aria-label={t('brief.contents')} className="rounded-xl border border-hair bg-s1 p-3">
          <p className="px-2 pb-1.5 text-xs font-medium text-fg-4">{t('brief.contents')}</p>
          <ol className="flex flex-col">
            {b.themes.map((th, i) => (
              <li key={th.id}>
                <button onClick={() => jump(th.id)} className="flex w-full items-baseline gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-fg-2 hover:bg-s2 hover:text-fg-1">
                  <span aria-hidden className="font-mono text-xs tabular-nums text-fg-4">{String(i + 1).padStart(2, '0')}</span>
                  {th.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <HowToRead sample={sample} matchId={match.id} engine={lp.engine} eventOnly={lp.eventOnly} />
        <InlineAlert>{t('brief.sample_note')}</InlineAlert>
      </aside>
    </div>
  )
}
