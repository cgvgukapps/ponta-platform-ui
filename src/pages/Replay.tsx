import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Diamond, Keyboard, Pause, Play, SkipBack, SkipForward, StepBack, StepForward } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { useMatch, LockedPanel } from '@/components/shell/MatchLayout'
import { useAsync } from '@/lib/useAsync'
import { getBrief, parityFor } from '@/api'
import { loadPack, type LoadedPack } from '@/api/packs'
import { Button } from '@/components/ui/button'
import { EmptyState, InlineAlert, Skeleton } from '@/components/ui/feedback'
import { Kbd, ParityIcon, ConfidenceMeter } from '@/components/ui/badges'
import { Popover, PopoverContent, PopoverTrigger, Tooltip } from '@/components/ui/overlay'
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApp } from '@/state/app'
import { fmtClock, fmtClockFine } from '@/lib/format'
import type { MatchEvent, MetricId, ParityState } from '@/lib/types'
import { PlaybackStore, useClock, usePlaying, useSpeed } from '@/components/replay/playback'
import { PitchCanvas, type Overlays } from '@/components/replay/PitchCanvas'
import { Timeline } from '@/components/replay/Timeline'
import { ExplainCard } from '@/components/replay/ExplainCard'
import { EventList, isNotable, type EventFilter } from '@/components/replay/EventList'
import { PlayerTable } from '@/components/replay/PlayerTable'
import { Legend } from '@/components/replay/Legend'

const FRAME = 0.04

interface ToggleDef {
  key: keyof Overlays
  label: string
  metric: MetricId | null
  shortcut: string
  needsPlayers: boolean
}
const TOGGLES: ToggleDef[] = [
  { key: 'control', label: 'replay.ov_control', metric: 'control_surface', shortcut: '1', needsPlayers: true },
  { key: 'value', label: 'replay.ov_value', metric: 'pass_value', shortcut: '2', needsPlayers: true },
  { key: 'corridors', label: 'replay.ov_corridors', metric: 'pass_alternatives', shortcut: '3', needsPlayers: false },
  { key: 'carries', label: 'replay.ov_carries', metric: 'carry_alternatives', shortcut: '4', needsPlayers: false },
  { key: 'confidence', label: 'replay.ov_confidence', metric: null, shortcut: '5', needsPlayers: true },
]

function OverlayToggle({ def, on, state, reason, disabled, onChange }: { def: ToggleDef; on: boolean; state: ParityState | null; reason?: string; disabled: boolean; onChange: (v: boolean) => void }) {
  const btn = (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-sm transition-colors duration-[var(--dur-fast)] disabled:cursor-not-allowed',
        on ? 'border-fg-3 bg-s3 text-fg-1' : 'border-hair-strong bg-s1 text-fg-2 hover:bg-s2 hover:text-fg-1',
        disabled && 'border-dashed text-fg-4 hover:bg-s1 hover:text-fg-4',
      )}
    >
      <span aria-hidden className={cn('flex size-3 items-center justify-center rounded-[2px] border', on ? 'border-fg-1 bg-fg-1 text-canvas' : 'border-fg-4')}>
        {on ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </span>
      {t(def.label)}
      {state && state !== 'full' ? <ParityIcon state={state} size={11} /> : null}
      <span className="font-mono text-2xs text-fg-4">{def.shortcut}</span>
    </button>
  )
  if (!reason) return btn
  return (
    <Tooltip content={reason}>
      <span tabIndex={disabled ? 0 : -1} className="inline-flex">
        {btn}
      </span>
    </Tooltip>
  )
}

export function ReplayPage() {
  const match = useMatch()
  const pack = useAsync(() => (match.pack ? loadPack(match.id) : Promise.reject(new Error('none'))), [match.id])
  const brief = useAsync(() => getBrief(match.id).catch(() => null), [match.id])
  if (!match.pack || match.briefStatus === 'locked') return <LockedPanel match={match} what={t('match.tab_replay')} />
  if (pack.error) return <EmptyState title={t('replay.error_title')} body={t('replay.error_body')} />
  if (pack.loading || !pack.data) {
    return (
      <div className="flex h-full gap-4 p-5">
        <Skeleton className="h-full min-h-[560px] flex-1" />
        <Skeleton className="h-full min-h-[560px] w-[400px]" />
      </div>
    )
  }
  const cited: string[] = []
  if (brief.data) for (const th of brief.data.themes) for (const b of th.bullets) for (const c of b.citations) if (!cited.includes(c)) cited.push(c)
  return <ReplayInner key={match.id} lp={pack.data} cited={cited} />
}

function ReplayInner({ lp, cited }: { lp: LoadedPack; cited: string[] }) {
  const { match } = lp
  const { toast } = useApp()
  const [params, setParams] = useSearchParams()
  const store = useMemo(() => new PlaybackStore(lp.data.duration, lp.data.htAt), [lp])
  useEffect(() => () => store.destroy(), [store])
  const parity = useMemo(() => parityFor(match), [match])

  const [overlays, setOverlays] = useState<Overlays>(() => ({ control: lp.data.teams.players && lp.data.teams.showAway, value: false, corridors: true, carries: true, confidence: false }))
  const [filter, setFilter] = useState<EventFilter>('notable')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null)
  const [tab, setTab] = useState('events')
  const selected = selectedId ? lp.byId.get(selectedId) ?? null : null

  const citedSet = useMemo(() => new Set(cited), [cited])
  const notable = useMemo(() => lp.events.filter((e) => isNotable(e, citedSet)), [lp, citedSet])
  const stepList = filter === 'all' ? lp.events : filter === 'cited' ? lp.events.filter((e) => citedSet.has(e.id)) : notable

  const select = useCallback(
    (e: MatchEvent, opts?: { seek?: boolean }) => {
      setSelectedId(e.id)
      if (opts?.seek !== false) {
        store.pause()
        store.seek(e.t)
      }
      setParams((p) => {
        const n = new URLSearchParams(p)
        n.set('event', e.id)
        return n
      }, { replace: true })
    },
    [store, setParams],
  )

  // Initial state: honour ?event=, otherwise open on a cited moment (or a notable one).
  const booted = useRef(false)
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const fromUrl = params.get('event')
    const e = (fromUrl && lp.byId.get(fromUrl)) || lp.byId.get(cited[Math.floor(cited.length / 2)] ?? '') || notable[Math.floor(notable.length / 3)]
    if (e) select(e)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Citation links while already on the page.
  const urlEvent = params.get('event')
  useEffect(() => {
    if (!booted.current || !urlEvent || urlEvent === selectedId) return
    const e = lp.byId.get(urlEvent)
    if (e) select(e)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlEvent])

  const stepEvent = useCallback(
    (dir: 1 | -1) => {
      const now = store.t
      const list = stepList
      if (!list.length) return
      if (dir === 1) {
        const n = list.find((e) => e.t > now + 0.3)
        if (n) select(n)
      } else {
        for (let i = list.length - 1; i >= 0; i--) {
          if (list[i].t < now - 0.3) {
            select(list[i])
            return
          }
        }
      }
    },
    [store, stepList, select],
  )
  const nextCitation = useCallback(() => {
    const evs = cited.map((id) => lp.byId.get(id)).filter(Boolean) as MatchEvent[]
    evs.sort((a, b) => a.t - b.t)
    const n = evs.find((e) => e.t > store.t + 0.3) ?? evs[0]
    if (n) select(n)
  }, [cited, lp, store, select])

  // Availability per overlay, derived from the parity report.
  const avail = (d: ToggleDef) => {
    const state: ParityState | null = d.metric ? parity.metrics[d.metric].state : null
    const needs = d.needsPlayers && !lp.data.teams.players
    const bothTeams = d.key === 'control' || d.key === 'value' ? lp.data.teams.showHome && lp.data.teams.showAway : true
    const blocked = state === 'blocked' || needs || !bothTeams
    return { state, blocked, reason: blocked ? (d.metric ? parity.metrics[d.metric].reason : t('replay.no_positions')) : state === 'degraded' && d.metric ? parity.metrics[d.metric].reason : undefined }
  }

  // Keyboard
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null
      if (!el || ev.metaKey || ev.ctrlKey || ev.altKey) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return
      const k = ev.key
      if (k === ' ' && (/^(BUTTON|A)$/.test(el.tagName) || el.getAttribute('role') === 'option')) return
      const step = ev.shiftKey ? 5 : FRAME
      switch (k) {
        case ' ':
          store.toggle()
          break
        case 'ArrowLeft':
          store.pause()
          store.seek(store.t - step)
          break
        case 'ArrowRight':
          store.pause()
          store.seek(store.t + step)
          break
        case '[':
          stepEvent(-1)
          break
        case ']':
          stepEvent(1)
          break
        case 'c':
        case 'C':
          nextCitation()
          break
        case ',':
          store.setSpeed(Math.max(0.25, store.speed / 2))
          break
        case '.':
          store.setSpeed(Math.min(4, store.speed * 2))
          break
        default: {
          const d = TOGGLES.find((x) => x.shortcut === k)
          if (d && !avail(d).blocked) setOverlays((o) => ({ ...o, [d.key]: !o[d.key] }))
          return
        }
      }
      ev.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, stepEvent, nextCitation])

  const copyLink = (e: MatchEvent) => {
    const url = `${location.origin}/matches/${match.id}/replay?event=${e.id}`
    navigator.clipboard?.writeText(url).catch(() => undefined)
    toast({ title: t('replay.toast_link'), body: e.id })
  }
  const playFrom = (e: MatchEvent) => {
    store.seek(Math.max(0, e.t - 5))
    store.play()
  }

  return (
    <div className="flex h-full min-h-[640px] gap-4 p-4">
      <section aria-label={t('replay.stage')} className="flex min-w-0 flex-1 flex-col gap-2.5">
        <Toolbar lp={lp} store={store} overlays={overlays} setOverlays={setOverlays} avail={avail} />
        {lp.eventOnly ? (
          <InlineAlert tone="neutral" title={t('replay.eo_banner_title')}>
            {t('replay.eo_banner_body')}
          </InlineAlert>
        ) : !lp.data.teams.showAway ? (
          <InlineAlert tone="neutral" title={t('replay.gps_banner_title')}>
            {t('replay.gps_banner_body')}
          </InlineAlert>
        ) : null}
        <div className="relative min-h-0 flex-1">
          <FrameConfidence lp={lp} store={store} />
          <PitchCanvas lp={lp} store={store} overlays={overlays} selected={selected} selectedPlayer={selectedPlayer} onPlayerClick={setSelectedPlayer} />
        </div>
        <Legend overlays={overlays} eventOnly={lp.eventOnly} />
        <Timeline lp={lp} store={store} notable={notable} cited={cited} selectedId={selectedId} onSelect={select} />
        <Transport store={store} lp={lp} onStepEvent={stepEvent} onNextCitation={nextCitation} hasCitations={cited.length > 0} />
      </section>

      <aside aria-label={t('replay.side')} className="flex w-[400px] shrink-0 flex-col gap-3 overflow-y-auto">
        <div className="shrink-0">
          <ExplainCard event={selected} htAt={lp.data.htAt} onPlayFrom={playFrom} onCopy={copyLink} />
        </div>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-[260px] flex-1 flex-col">
          <TabsList label={t('replay.side_tabs')}>
            <TabsTrigger value="events">{t('replay.events')}</TabsTrigger>
            <TabsTrigger value="players">{t('replay.players')}</TabsTrigger>
          </TabsList>
          <TabsContent value="events" className="min-h-0 flex-1 pt-3 data-[state=inactive]:hidden">
            <EventsPane lp={lp} store={store} cited={cited} selectedId={selectedId} onSelect={select} filter={filter} onFilter={setFilter} />
          </TabsContent>
          <TabsContent value="players" className="min-h-0 flex-1 pt-3 data-[state=inactive]:hidden">
            <PlayerTable lp={lp} store={store} selected={selectedPlayer} onSelect={setSelectedPlayer} />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  )
}

function EventsPane(props: { lp: LoadedPack; store: PlaybackStore; cited: string[]; selectedId: string | null; onSelect: (e: MatchEvent) => void; filter: EventFilter; onFilter: (f: EventFilter) => void }) {
  const now = useClock(props.store, 1)
  return <EventList events={props.lp.events} cited={props.cited} selectedId={props.selectedId} currentT={now} onSelect={props.onSelect} filter={props.filter} onFilter={props.onFilter} />
}

function Toolbar({ lp, store, overlays, setOverlays, avail }: { lp: LoadedPack; store: PlaybackStore; overlays: Overlays; setOverlays: React.Dispatch<React.SetStateAction<Overlays>>; avail: (d: ToggleDef) => { state: ParityState | null; blocked: boolean; reason?: string } }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label={t('replay.overlays')}>
      <span className="mr-1 text-xs font-medium text-fg-4">{t('replay.overlays')}</span>
      {TOGGLES.map((d) => {
        const a = avail(d)
        return <OverlayToggle key={d.key} def={d} on={overlays[d.key] && !a.blocked} state={a.state} reason={a.reason} disabled={a.blocked} onChange={(v) => setOverlays((o) => ({ ...o, [d.key]: v }))} />
      })}
      <div className="ml-auto flex items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" aria-label={t('replay.shortcuts')}>
              <Keyboard className="size-3.5" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[280px]">
            <p className="mb-2 text-sm font-medium text-fg-1">{t('replay.shortcuts')}</p>
            <ul className="flex flex-col gap-1.5 text-sm text-fg-2">
              {(
                [
                  ['Space', 'replay.sc_play'],
                  ['← →', 'replay.sc_frame'],
                  ['Shift + ← →', 'replay.sc_five'],
                  ['[  ]', 'replay.sc_event'],
                  ['C', 'replay.sc_cite'],
                  [', .', 'replay.sc_speed'],
                  ['1 to 5', 'replay.sc_overlays'],
                ] as const
              ).map(([k, l]) => (
                <li key={k} className="flex items-center justify-between gap-3">
                  <span>{t(l)}</span>
                  <Kbd>{k}</Kbd>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

function FrameConfidence({ lp, store }: { lp: LoadedPack; store: PlaybackStore }) {
  const now = useClock(store, 0.5)
  if (!lp.data.teams.players) return null
  return (
    <span className="absolute right-2 top-2 z-10 inline-flex items-center gap-2 rounded-sm border border-hair bg-canvas px-2 py-1 text-xs text-fg-3">
      {t('replay.frame_conf')}
      <ConfidenceMeter value={lp.engine.confidenceAt(now)} />
    </span>
  )
}

function Transport({ store, lp, onStepEvent, onNextCitation, hasCitations }: { store: PlaybackStore; lp: LoadedPack; onStepEvent: (d: 1 | -1) => void; onNextCitation: () => void; hasCitations: boolean }) {
  const now = useClock(store, FRAME)
  const playing = usePlaying(store)
  const speed = useSpeed(store)
  void lp
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={t('replay.transport')}>
      <Tooltip content={t('replay.prev_event')}>
        <Button size="icon-sm" variant="ghost" aria-label={t('replay.prev_event')} onClick={() => onStepEvent(-1)}>
          <SkipBack className="size-3.5" aria-hidden />
        </Button>
      </Tooltip>
      <Tooltip content={t('replay.prev_frame')}>
        <Button size="icon-sm" variant="ghost" aria-label={t('replay.prev_frame')} onClick={() => (store.pause(), store.seek(store.t - FRAME))}>
          <StepBack className="size-3.5" aria-hidden />
        </Button>
      </Tooltip>
      <Button size="sm" variant="primary" className="w-[88px]" onClick={() => store.toggle()} aria-label={playing ? t('replay.pause') : t('replay.play')}>
        {playing ? <Pause className="size-3.5 fill-current" aria-hidden /> : <Play className="size-3.5 fill-current" aria-hidden />}
        {playing ? t('replay.pause') : t('replay.play')}
      </Button>
      <Tooltip content={t('replay.next_frame')}>
        <Button size="icon-sm" variant="ghost" aria-label={t('replay.next_frame')} onClick={() => (store.pause(), store.seek(store.t + FRAME))}>
          <StepForward className="size-3.5" aria-hidden />
        </Button>
      </Tooltip>
      <Tooltip content={t('replay.next_event')}>
        <Button size="icon-sm" variant="ghost" aria-label={t('replay.next_event')} onClick={() => onStepEvent(1)}>
          <SkipForward className="size-3.5" aria-hidden />
        </Button>
      </Tooltip>
      {hasCitations ? (
        <Button size="sm" variant="ghost" onClick={onNextCitation}>
          <Diamond className="size-3 text-highlight" aria-hidden />
          {t('replay.next_citation')}
        </Button>
      ) : null}
      <div className="ml-auto flex items-center gap-4">
        <Segmented
          size="sm"
          label={t('replay.speed')}
          value={String(speed)}
          onValueChange={(v) => store.setSpeed(Number(v))}
          options={[0.25, 0.5, 1, 2, 4].map((s) => ({ value: String(s), label: `${s}×`, ariaLabel: `${s}× ${t('replay.speed')}` }))}
        />
        <p className="font-mono text-sm tabular-nums text-fg-1" aria-label={t('replay.clock')}>
          {fmtClockFine(now)}
          <span className="text-fg-4"> / {fmtClock(store.duration)}</span>
        </p>
        <span className="font-mono text-2xs text-fg-4">25 Hz</span>
      </div>
    </div>
  )
}

export default ReplayPage
