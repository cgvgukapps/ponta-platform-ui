import { useEffect, useMemo, useRef, useState } from 'react'
import { Diamond } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import type { MatchEvent } from '@/lib/types'
import { fmtClock } from '@/lib/format'
import { describeEvent, eventTypeLabel } from '@/lib/events'
import { ConfidenceGlyph, DqBand, EstimateBand, TeamDot } from '@/components/ui/badges'
import { Segmented } from '@/components/ui/tabs'
import { confLevel } from '@/lib/bands'

export type EventFilter = 'notable' | 'all' | 'cited'
const ROW = 44

/** Notable moments: cited, key, shots, poor decisions under pressure, big runs, sprints, high-pressure losses. */
export function isNotable(e: MatchEvent, citedSet: Set<string>) {
  if (citedSet.has(e.id) || e.key || e.type === 'shot') return true
  if (e.type === 'run') return (e.ovm ?? 0) >= 0.45
  if (e.type === 'effort') return e.effort?.kind === 'sprint'
  if (e.type === 'pass' || e.type === 'carry') {
    if (e.band === 'poor' && e.press >= 0.55) return true
    return e.outcome === 'lost' && e.press >= 0.78
  }
  return false
}

export function EventList({ events, cited, selectedId, currentT, onSelect, filter, onFilter }: { events: MatchEvent[]; cited: string[]; selectedId: string | null; currentT: number; onSelect: (e: MatchEvent) => void; filter: EventFilter; onFilter: (f: EventFilter) => void }) {
  const citedSet = useMemo(() => new Set(cited), [cited])
  const list = useMemo(() => {
    if (filter === 'all') return events
    if (filter === 'cited') return events.filter((e) => citedSet.has(e.id))
    return events.filter((e) => isNotable(e, citedSet))
  }, [events, filter, citedSet])
  const box = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(0)
  const [h, setH] = useState(300)
  const follow = useRef(true)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setH(el.clientHeight))
    ro.observe(el)
    setH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  // Keep the selected event in view when it changes from elsewhere (timeline, citation link, keyboard).
  useEffect(() => {
    const el = box.current
    if (!el || !selectedId) return
    const i = list.findIndex((e) => e.id === selectedId)
    if (i < 0) return
    const top = i * ROW
    if (top < el.scrollTop || top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = Math.max(0, top - el.clientHeight / 2 + ROW / 2)
  }, [selectedId, list])

  const first = Math.max(0, Math.floor(scroll / ROW) - 4)
  const last = Math.min(list.length, Math.ceil((scroll + h) / ROW) + 4)
  // Index of the first event at or after the playhead, for the "now" marker.
  const nowIdx = useMemo(() => {
    let lo = 0
    let hi = list.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (list[mid].t < currentT) lo = mid + 1
      else hi = mid
    }
    return lo
  }, [list, currentT])
  void follow

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 pb-2">
        <Segmented
          size="sm"
          label={t('replay.events_filter')}
          value={filter}
          onValueChange={onFilter}
          options={[
            { value: 'notable', label: t('replay.filter_notable') },
            { value: 'cited', label: t('replay.filter_cited') },
            { value: 'all', label: t('replay.filter_all') },
          ]}
        />
        <span className="font-mono text-2xs tabular-nums text-fg-4">{list.length}</span>
      </div>
      <div ref={box} className="relative min-h-0 flex-1 overflow-y-auto rounded-md border border-hair bg-s1" onScroll={(e) => setScroll(e.currentTarget.scrollTop)} role="listbox" aria-label={t('replay.events')} tabIndex={0}>
        {list.length === 0 ? <p className="p-4 text-sm text-fg-3">{t('replay.no_events')}</p> : null}
        <div style={{ height: list.length * ROW, position: 'relative' }}>
          {list.slice(first, last).map((e, k) => {
            const i = first + k
            const sel = e.id === selectedId
            const isCited = citedSet.has(e.id)
            return (
              <button
                key={e.id}
                role="option"
                aria-selected={sel}
                onClick={() => onSelect(e)}
                style={{ position: 'absolute', top: i * ROW, height: ROW, left: 0, right: 0 }}
                className={cn('flex items-center gap-2.5 border-b border-hair px-3 text-left transition-colors duration-[var(--dur-fast)] hover:bg-s2', sel && 'bg-s3', i === nowIdx && !sel && 'bg-s2')}
              >
                <span className="w-[42px] shrink-0 font-mono text-xs tabular-nums text-fg-2">{fmtClock(e.t)}</span>
                <TeamDot team={e.team} size={8} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm text-fg-1">
                    <span className="truncate">{eventTypeLabel(e)}</span>
                    {isCited ? <Diamond className="size-2.5 shrink-0 text-highlight" aria-label={t('replay.cited')} /> : null}
                  </span>
                  <span className="block truncate text-xs text-fg-3">{describeEvent(e)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  {e.band ? <DqBand band={e.band} size="sm" /> : e.est ? <EstimateBand lo={e.est.lo} hi={e.est.hi} size="sm" /> : e.ovm !== undefined ? <span className="font-mono text-xs tabular-nums text-fg-1">+{e.ovm.toFixed(2)}</span> : e.effort ? <span className="font-mono text-xs tabular-nums text-fg-1">{e.effort.peak.toFixed(1)} m/s</span> : null}
                  {confLevel(e.conf) === 'low' ? (
                    <span className="inline-flex items-center gap-1 font-mono text-2xs tabular-nums text-fg-3">
                      <ConfidenceGlyph value={e.conf} size={9} />
                      {e.conf.toFixed(2)}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
