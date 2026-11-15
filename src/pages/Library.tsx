import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, ArrowUpDown, BookText, Film, Gauge, LayoutGrid, MoreHorizontal, Plus, RefreshCw, Rows3, Trash2, Upload, X, FileSearch, Bookmark } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { useApp } from '@/state/app'
import { useAsync } from '@/lib/useAsync'
import { listMatches, parityFor } from '@/api'
import { PROCESSING_STAGES, type BriefStatus, type Match, type MatchStatus, type ParityState } from '@/lib/types'
import { fmtDate, fmtRelative } from '@/lib/format'
import { PROVIDER_NAME, KIND_KEY } from '@/lib/providers'
import { buttonStyles, Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/form'
import { Segmented } from '@/components/ui/tabs'
import { ParitySummary, StatusBadge, Tag, TierBadge } from '@/components/ui/badges'
import { EmptyState, InlineAlert, ProgressBar, Skeleton } from '@/components/ui/feedback'
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal, Tooltip } from '@/components/ui/overlay'
import { parityStates } from '@/components/shell/MatchLayout'

type SortKey = 'fixture' | 'date' | 'tier' | 'status' | 'opened'
interface Filters {
  q: string
  competition: string
  date: string
  provider: string
  tier: string
  parity: string
  status: string
}
const NO_FILTER: Filters = { q: '', competition: 'all', date: 'all', provider: 'all', tier: 'all', parity: 'all', status: 'all' }

const SAVED: { id: string; label: string; apply: Partial<Filters> }[] = [
  { id: 'ready', label: 'lib.saved_ready', apply: { status: 'ready' } },
  { id: 'attention', label: 'lib.saved_attention', apply: { status: 'attention' } },
  { id: 'event', label: 'lib.saved_event', apply: { provider: 'statsbomb' } },
  { id: 'dev', label: 'lib.saved_dev', apply: { tier: 'dev' } },
]

const STATUS_ORDER: Record<MatchStatus, number> = { failed: 0, needs_attention: 1, processing: 2, queued: 3, ready: 4 }

function matchesFilters(m: Match, f: Filters, squad: string): boolean {
  if (squad !== 'all' && m.squad !== squad) return false
  const q = f.q.trim().toLowerCase()
  if (q && !`${m.home} ${m.away} ${m.competition}`.toLowerCase().includes(q)) return false
  if (f.competition !== 'all' && m.competition !== f.competition) return false
  if (f.provider !== 'all' && !m.sources.some((s) => s.provider === f.provider)) return false
  if (f.tier === 'dev' ? m.tierStatus !== 'in_development' : f.tier !== 'all' && String(m.tier) !== f.tier) return false
  if (f.status === 'attention' ? m.status !== 'needs_attention' && m.status !== 'failed' : f.status !== 'all' && m.status !== f.status) return false
  if (f.date !== 'all') {
    const days = f.date === '7' ? 7 : f.date === '30' ? 30 : 60
    if (Date.now() && new Date('2026-11-15T14:41:00Z').getTime() - new Date(m.date).getTime() > days * 86400000) return false
  }
  if (f.parity !== 'all') {
    if (m.status !== 'ready') return false
    const s = parityFor(m).summary
    if (f.parity === 'blocked' && s.blocked === 0) return false
    if (f.parity === 'degraded' && s.degraded === 0) return false
    if (f.parity === 'full' && (s.blocked > 0 || s.degraded > 0)) return false
  }
  return true
}

const briefLabel: Record<BriefStatus, string> = { ready: 'lib.brief_ready', generating: 'lib.brief_generating', not_generated: 'lib.brief_none', locked: 'lib.brief_locked' }

function Sources({ m }: { m: Match }) {
  return (
    <div className="flex flex-col gap-0.5">
      {m.sources.map((s, i) => (
        <div key={i} className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-xs text-fg-1">{PROVIDER_NAME[s.provider]}</span>
          <span className="text-2xs text-fg-4">{t(KIND_KEY[s.kind])}</span>
        </div>
      ))}
    </div>
  )
}

function ParityCell({ m }: { m: Match }) {
  if (m.status !== 'ready') return <span className="text-xs text-fg-4">{m.status === 'queued' || m.status === 'processing' ? t('lib.parity_pending') : t('lib.parity_na')}</span>
  return <ParitySummary summary={parityFor(m).summary} states={parityStates(m)} compact />
}

function QuickActions({ m, onReprocess, onDelete }: { m: Match; onReprocess: () => void; onDelete: () => void }) {
  const nav = useNavigate()
  const ready = m.status === 'ready'
  const canBrief = ready && m.briefStatus === 'ready'
  const canReplay = ready && !!m.pack
  const icon = 'size-3.5'
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Tooltip content={t('lib.open_brief')}>
        <Button variant="ghost" size="icon-sm" disabled={!canBrief} aria-label={t('lib.open_brief')} onClick={() => nav(`/matches/${m.id}/brief`)}>
          <BookText className={icon} aria-hidden />
        </Button>
      </Tooltip>
      <Tooltip content={t('lib.open_replay')}>
        <Button variant="ghost" size="icon-sm" disabled={!canReplay} aria-label={t('lib.open_replay')} onClick={() => nav(`/matches/${m.id}/replay`)}>
          <Film className={icon} aria-hidden />
        </Button>
      </Tooltip>
      <Tooltip content={t('lib.open_parity')}>
        <Button variant="ghost" size="icon-sm" disabled={!ready} aria-label={t('lib.open_parity')} onClick={() => nav(`/matches/${m.id}/parity`)}>
          <Gauge className={icon} aria-hidden />
        </Button>
      </Tooltip>
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('lib.more_actions')}>
            <MoreHorizontal className={icon} aria-hidden />
          </Button>
        </MenuTrigger>
        <MenuContent align="end" className="w-44">
          <MenuItem onSelect={onReprocess}>
            <RefreshCw className={icon} aria-hidden />
            {t('lib.reprocess')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={onDelete}>
            <Trash2 className={icon} aria-hidden />
            {t('lib.delete')}
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  )
}

function SortTh({ label, k, sort, setSort, className }: { label: string; k: SortKey; sort: { k: SortKey; dir: 1 | -1 }; setSort: (s: { k: SortKey; dir: 1 | -1 }) => void; className?: string }) {
  const active = sort.k === k
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={cn('h-8 px-3 text-left align-middle', className)}>
      <button onClick={() => setSort({ k, dir: active ? (sort.dir === 1 ? -1 : 1) : 1 })} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-sm font-mono text-2xs font-medium uppercase tracking-wider hover:text-fg-1', active ? 'text-fg-1' : 'text-fg-3')}>
        {label}
        {active ? sort.dir === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden /> : <ArrowUpDown className="size-3 opacity-50" aria-hidden />}
      </button>
    </th>
  )
}

function StatusCell({ m }: { m: Match }) {
  const stage = m.status === 'processing' && m.stage !== undefined ? t(`stage.${PROCESSING_STAGES[m.stage]}`) : undefined
  // Multi-source matches are checked but not analysed yet: say that, not "Ready".
  const checkedOnly = m.status === 'ready' && m.tierStatus === 'in_development'
  return (
    <div className="flex min-w-[120px] flex-col gap-1">
      {checkedOnly ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-fg-2">
          <Gauge className="size-3.5 text-fg-3" aria-hidden />
          {t('status.checked_only')}
        </span>
      ) : (
        <StatusBadge status={m.status} stage={stage} />
      )}
      {m.status === 'processing' ? <ProgressBar value={((m.stage ?? 0) + (m.stageProgress ?? 0)) / PROCESSING_STAGES.length} label={t('status.processing')} className="w-28" /> : null}
    </div>
  )
}

export function Library() {
  const { orgId, squad, toast } = useApp()
  const nav = useNavigate()
  const { data, loading } = useAsync(() => listMatches(orgId), [orgId])
  const [view, setView] = useState<'table' | 'cards'>('table')
  const [filters, setFilters] = useState<Filters>(NO_FILTER)
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'date', dir: -1 })
  const [removed, setRemoved] = useState<string[]>([])
  const [requeued, setRequeued] = useState<string[]>([])
  const [confirm, setConfirm] = useState<Match | null>(null)

  const matches = useMemo(() => (data ?? []).filter((m) => !removed.includes(m.id)).map((m) => (requeued.includes(m.id) ? ({ ...m, status: 'queued', issue: undefined } as Match) : m)), [data, removed, requeued])
  const competitions = useMemo(() => Array.from(new Set(matches.map((m) => m.competition))).sort(), [matches])
  const rows = useMemo(() => {
    const out = matches.filter((m) => matchesFilters(m, filters, squad))
    const cmp: Record<SortKey, (a: Match, b: Match) => number> = {
      fixture: (a, b) => a.home.localeCompare(b.home),
      date: (a, b) => a.date.localeCompare(b.date),
      tier: (a, b) => a.tier - b.tier,
      status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
      opened: (a, b) => (a.lastOpened ?? '').localeCompare(b.lastOpened ?? ''),
    }
    return out.sort((a, b) => cmp[sort.k](a, b) * sort.dir)
  }, [matches, filters, squad, sort])

  const active = (Object.keys(filters) as (keyof Filters)[]).filter((k) => filters[k] !== NO_FILTER[k])
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }))
  const open = (m: Match) => nav(`/matches/${m.id}`)

  if (!loading && matches.length === 0 && (data ?? []).length === 0) {
    return (
      <div className="px-8 py-6">
        <h1 className="text-lg font-semibold text-fg-1">{t('lib.title')}</h1>
        <EmptyState
          className="py-24"
          icon={<Upload className="size-5" aria-hidden />}
          title={t('lib.empty_title')}
          body={t('lib.empty_body')}
          actions={
            <>
              <Link to="/matches/new" className={buttonStyles({ variant: 'primary' })}>
                <Plus className="size-3.5" aria-hidden />
                {t('lib.add_data')}
              </Link>
              <Link to="/matches/new" className={buttonStyles({ variant: 'secondary' })}>
                {t('lib.supported_formats')}
              </Link>
            </>
          }
        />
      </div>
    )
  }

  return (
    <div className="px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-fg-1">{t('lib.title')}</h1>
          <p className="mt-0.5 text-sm text-fg-3">{loading ? t('common.loading') : t('lib.subtitle', { n: rows.length, total: matches.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            label={t('lib.view')}
            value={view}
            onValueChange={setView}
            options={[
              { value: 'table', label: <Rows3 className="size-3.5" aria-hidden />, ariaLabel: t('lib.view_table') },
              { value: 'cards', label: <LayoutGrid className="size-3.5" aria-hidden />, ariaLabel: t('lib.view_cards') },
            ]}
          />
          <Link to="/matches/new" className={buttonStyles({ variant: 'primary' })}>
            <Plus className="size-3.5" aria-hidden />
            {t('lib.add_data')}
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={t('lib.filters')}>
        <div className="w-56">
          <Input aria-label={t('lib.search')} placeholder={t('lib.search')} value={filters.q} onChange={(e) => set({ q: e.target.value })} />
        </div>
        <Select aria-label={t('lib.f_competition')} value={filters.competition} onValueChange={(v) => set({ competition: v })} className="w-44" options={[{ value: 'all', label: t('lib.f_competition_all') }, ...competitions.map((c) => ({ value: c, label: c }))]} />
        <Select aria-label={t('lib.f_date')} value={filters.date} onValueChange={(v) => set({ date: v })} className="w-36" options={[{ value: 'all', label: t('lib.f_date_all') }, { value: '7', label: t('lib.f_date_7') }, { value: '30', label: t('lib.f_date_30') }, { value: '60', label: t('lib.f_date_60') }]} />
        <Select aria-label={t('lib.f_provider')} value={filters.provider} onValueChange={(v) => set({ provider: v })} className="w-36" options={[{ value: 'all', label: t('lib.f_provider_all') }, ...Object.entries(PROVIDER_NAME).map(([k, v]) => ({ value: k, label: v }))]} />
        <Select aria-label={t('lib.f_tier')} value={filters.tier} onValueChange={(v) => set({ tier: v })} className="w-36" options={[{ value: 'all', label: t('lib.f_tier_all') }, { value: '1', label: t('tier.name_1') }, { value: '2', label: t('tier.name_2') }, { value: '3', label: t('tier.name_3') }, { value: 'dev', label: t('tier.in_development') }]} />
        <Select aria-label={t('lib.f_parity')} value={filters.parity} onValueChange={(v) => set({ parity: v })} className="w-40" options={[{ value: 'all', label: t('lib.f_parity_all') }, { value: 'full', label: t('lib.f_parity_full') }, { value: 'degraded', label: t('lib.f_parity_degraded') }, { value: 'blocked', label: t('lib.f_parity_blocked') }]} />
        <Select aria-label={t('lib.f_status')} value={filters.status} onValueChange={(v) => set({ status: v })} className="w-36" options={[{ value: 'all', label: t('lib.f_status_all') }, { value: 'ready', label: t('status.ready') }, { value: 'processing', label: t('status.processing') }, { value: 'queued', label: t('status.queued') }, { value: 'attention', label: t('lib.saved_attention') }]} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={t('lib.saved')}>
        <span className="mr-1 flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wider text-fg-4">
          <Bookmark className="size-3" aria-hidden />
          {t('lib.saved')}
        </span>
        {SAVED.map((s) => {
          const on = Object.entries(s.apply).every(([k, v]) => filters[k as keyof Filters] === v)
          return (
            <button key={s.id} aria-pressed={on} onClick={() => setFilters(on ? NO_FILTER : { ...NO_FILTER, ...s.apply })} className={cn('h-6 rounded-full border px-2.5 text-xs transition-colors duration-[var(--dur-fast)]', on ? 'border-accent bg-accent-tint text-fg-1' : 'border-hair-strong text-fg-2 hover:bg-s2 hover:text-fg-1')}>
              {t(s.label)}
            </button>
          )
        })}
        {active.length ? (
          <>
            <span className="mx-1 h-4 w-px bg-hair-strong" aria-hidden />
            <button onClick={() => setFilters(NO_FILTER)} className="inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs text-fg-3 hover:text-fg-1">
              <X className="size-3" aria-hidden />
              {t('lib.clear_filters')}
            </button>
            <button onClick={() => toast({ title: t('lib.toast_saved'), body: t('lib.toast_saved_body') })} className="inline-flex h-6 items-center rounded-full px-2 text-xs text-accent-text hover:underline">
              {t('lib.save_filter')}
            </button>
          </>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-5 space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<FileSearch className="size-5" aria-hidden />} title={t('lib.no_results')} body={t('lib.no_results_body')} actions={<Button onClick={() => setFilters(NO_FILTER)}>{t('lib.clear_filters')}</Button>} />
      ) : view === 'table' ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-hair bg-s1">
          <table className="w-full min-w-[960px] [&_td]:px-2.5 [&_th]:px-2.5 border-collapse text-sm">
            <caption className="sr-only">{t('lib.title')}</caption>
            <thead className="sticky top-0 z-10 bg-s1">
              <tr className="border-b border-hair">
                <SortTh label={t('lib.col_fixture')} k="fixture" sort={sort} setSort={setSort} />
                <SortTh label={t('lib.col_date')} k="date" sort={sort} setSort={setSort} />
                <th scope="col" className="h-8 px-3 text-left font-mono text-2xs font-medium uppercase tracking-wider text-fg-3">{t('lib.col_providers')}</th>
                <SortTh label={t('lib.col_tier')} k="tier" sort={sort} setSort={setSort} />
                <th scope="col" className="h-8 px-3 text-left font-mono text-2xs font-medium uppercase tracking-wider text-fg-3">{t('lib.col_parity')}</th>
                <SortTh label={t('lib.col_status')} k="status" sort={sort} setSort={setSort} />
                <th scope="col" className="h-8 w-[112px] px-3"><span className="sr-only">{t('lib.col_actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} onClick={() => open(m)} className="group cursor-pointer border-b border-hair last:border-0 hover:bg-s2">
                  <td className="max-w-[240px] px-3 py-2.5 align-top">
                    <Link to={`/matches/${m.id}`} onClick={(e) => e.stopPropagation()} className="line-clamp-2 font-medium text-fg-1 hover:underline focus-visible:underline">
                      {m.home} <span className="font-normal text-fg-3">{m.score ? `${m.score[0]}–${m.score[1]}` : 'v'}</span> {m.away}
                    </Link>
                    {m.fixtureNote ? <span className="mt-0.5 block text-xs text-fg-3">{m.fixtureNote}</span> : null}
                    {m.issue && (m.status === 'failed' || m.status === 'needs_attention') ? (
                      <span className={cn('mt-1 block max-w-[300px] text-xs leading-snug', m.status === 'failed' ? 'text-danger' : 'text-warn')}>
                        {m.issue}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[140px] px-3 py-2.5 align-top">
                    <span className="block whitespace-nowrap font-mono text-xs tabular-nums text-fg-2">{fmtDate(m.date)}</span>
                    <span className="mt-0.5 block truncate text-xs text-fg-3" title={m.competition}>{m.competition}</span>
                  </td>
                  <td className="px-3 py-2.5 align-top"><Sources m={m} /></td>
                  <td className="px-3 py-2.5 align-top"><TierBadge tier={m.tier} status={m.tierStatus} /></td>
                  <td className="px-3 py-2.5 align-top"><ParityCell m={m} /></td>
                  <td className="px-3 py-2.5 align-top">
                    <StatusCell m={m} />
                    {m.status === 'ready' ? <span className={cn('mt-1 block max-w-[110px] text-xs leading-tight', m.briefStatus === 'ready' ? 'text-fg-2' : 'text-fg-4')}>{t(briefLabel[m.briefStatus].replace('brief_', 'brief_line_'))}</span> : null}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <QuickActions m={m} onReprocess={() => { setRequeued((r) => [...r, m.id]); toast({ title: t('lib.toast_reprocess'), body: `${m.home} v ${m.away}` }) }} onDelete={() => setConfirm(m)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {rows.map((m) => (
            <article key={m.id} className="group flex flex-col gap-3 rounded-lg border border-hair bg-s1 p-4 transition-colors hover:border-hair-strong hover:bg-s2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/matches/${m.id}`} className="block truncate text-sm font-medium text-fg-1 hover:underline">
                    {m.home} <span className="font-normal text-fg-3">{m.score ? `${m.score[0]}–${m.score[1]}` : 'v'}</span> {m.away}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-fg-3">{m.competition} · {fmtDate(m.date)}</p>
                </div>
                <TierBadge tier={m.tier} status={m.tierStatus} />
              </div>
              <Sources m={m} />
              <div className="flex items-center justify-between gap-2">
                <ParityCell m={m} />
                <StatusCell m={m} />
              </div>
              <div className="flex items-center justify-between border-t border-hair pt-2">
                <span className="text-xs text-fg-4">{t(briefLabel[m.briefStatus])} · {fmtRelative(m.lastOpened)}</span>
                <QuickActions m={m} onReprocess={() => setRequeued((r) => [...r, m.id])} onDelete={() => setConfirm(m)} />
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-fg-4">{t('lib.footnote')}</p>

      <Modal
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('lib.delete_title')}
        description={confirm ? t('lib.delete_body', { name: `${confirm.home} v ${confirm.away}` }) : undefined}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm) setRemoved((r) => [...r, confirm.id])
                toast({ title: t('lib.toast_deleted') })
                setConfirm(null)
              }}
            >
              <Trash2 className="size-3.5" aria-hidden />
              {t('lib.delete')}
            </Button>
          </>
        }
      >
        <InlineAlert tone="neutral">{t('lib.delete_note')}</InlineAlert>
      </Modal>
    </div>
  )
}
