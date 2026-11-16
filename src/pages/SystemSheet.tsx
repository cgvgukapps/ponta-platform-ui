import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { AiMarker, ConfidenceIndicator, ConfidenceMeter, DqBand, EstimateBand, ParityBadge, StatusBadge, Tag, TeamDot, TierBadge, Kbd } from '@/components/ui/badges'
import { BAND_ORDER } from '@/lib/bands'
import { InlineAlert, ProgressBar } from '@/components/ui/feedback'
import { Threshold } from '@/components/ui/threshold'
import { CitationChip, MomentThumb } from '@/components/ui/moment'
import { useAsync } from '@/lib/useAsync'
import { loadPack } from '@/api/packs'
import type { MatchEvent } from '@/lib/types'

const SURFACES = ['canvas', 'surface-1', 'surface-2', 'surface-3']
const TEXTS = ['fg-1', 'fg-2', 'fg-3', 'fg-4']
const ACCENT = ['accent', 'accent-text', 'accent-fill', 'accent-fill-hover', 'accent-fill-active', 'accent-tint']
const TEAMS = ['team-home', 'team-away', 'highlight', 'pitch']
const HEAT = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `heat-${i}`)
const DQ = ['dq-poor', 'dq-suboptimal', 'dq-good', 'dq-optimal']
const PARITY = ['parity-ink', 'parity-ink-dim', 'on-parity']
const STATUS = ['danger', 'warn', 'conf-ink']

function Swatch({ v }: { v: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-6 rounded-sm border border-hair-strong" style={{ background: `var(--${v})` }} />
      <span className="font-mono text-xs text-fg-2">--{v}</span>
    </li>
  )
}
function Group({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-fg-4">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((i) => (
          <Swatch key={i} v={i} />
        ))}
      </ul>
    </div>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hair py-6">
      <h2 className="mb-4 text-md font-semibold text-fg-1">{title}</h2>
      {children}
    </section>
  )
}

export function SystemSheet() {
  const q = useAsync(() => loadPack('m_0412'), [])
  const sample = useMemo<MatchEvent | undefined>(() => q.data?.byId.get('evt_99482'), [q.data])
  const low = useMemo<MatchEvent | undefined>(() => q.data?.byId.get('evt_66190'), [q.data])
  return (
    <div className="mx-auto max-w-[1100px] px-8 py-8">
      <h1 className="text-xl font-semibold text-fg-1">System sheet</h1>
      <p className="mt-1 max-w-[64ch] text-sm text-fg-3">Component states and tokens, rendered from the live CSS custom properties. This page is for review only and is not part of the product navigation.</p>

      <Section title="Colour tokens">
        <div className="grid grid-cols-4 gap-6">
          <Group title="Surfaces" items={SURFACES} />
          <Group title="Text" items={TEXTS} />
          <Group title="Brand and interaction" items={ACCENT} />
          <Group title="Team and pitch" items={TEAMS} />
          <Group title="Value (heat)" items={HEAT} />
          <Group title="Decision quality" items={DQ} />
          <Group title="Parity" items={PARITY} />
          <Group title="Alerts and confidence" items={STATUS} />
        </div>
      </Section>

      <Section title="Buttons">
        <div className="grid grid-cols-[100px_repeat(5,auto)] items-center gap-x-4 gap-y-3">
          {(['primary', 'secondary', 'ghost', 'destructive'] as const).map((v) => (
            <div key={v} className="contents">
              <span className="font-mono text-xs text-fg-3">{v}</span>
              <Button variant={v}>Default</Button>
              <Button variant={v} force="hover">Hover</Button>
              <Button variant={v} force="active">Active</Button>
              <Button variant={v} force="focus">Focus</Button>
              <Button variant={v} disabled>Disabled</Button>
            </div>
          ))}
          <span className="font-mono text-xs text-fg-3">loading</span>
          <Button variant="primary" loading>Processing</Button>
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid max-w-[640px] grid-cols-3 gap-4">
          <Input placeholder="Default" aria-label="Default" />
          <Input placeholder="Hover" force="hover" aria-label="Hover" />
          <Input placeholder="Focus" force="focus" aria-label="Focus" />
        </div>
      </Section>

      <Section title="Parity (shape and pattern, never colour alone)">
        <div className="flex flex-wrap items-center gap-3">
          <ParityBadge state="full" />
          <ParityBadge state="degraded" />
          <ParityBadge state="blocked" />
          <ParityBadge state="blocked" inDevelopment />
          <TierBadge tier={1} />
          <TierBadge tier={2} status="in_development" />
          <TierBadge tier={3} status="in_development" />
        </div>
      </Section>

      <Section title="Decision quality: measured and event-only">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            {BAND_ORDER.map((b) => (
              <DqBand key={b} band={b} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <EstimateBand lo="suboptimal" hi="good" />
            <EstimateBand lo="good" hi="optimal" />
          </div>
        </div>
      </Section>

      <Section title="Confidence (level bar and dashed edge, no hue)">
        <div className="flex flex-wrap items-center gap-8">
          <ConfidenceMeter value={0.94} />
          <ConfidenceMeter value={0.8} />
          <ConfidenceMeter value={0.58} />
          <ConfidenceIndicator value={0.91} />
          <ConfidenceIndicator value={0.58} />
        </div>
      </Section>

      <Section title="Citations">
        <div className="flex flex-wrap items-center gap-3">
          {sample ? <CitationChip event={sample} matchId="m_0412" engine={q.data?.engine} /> : null}
          {low ? <CitationChip event={low} matchId="m_0412" engine={q.data?.engine} /> : null}
          <AiMarker detail="model 0.4 (sample)" />
          <Threshold id="high_pressure" />
        </div>
        {sample && q.data ? (
          <div className="mt-4 w-[240px] overflow-hidden rounded-md border border-hair-strong">
            <MomentThumb event={sample} frame={q.data.engine.frame(sample.t)} />
          </div>
        ) : null}
      </Section>

      <Section title="Status, teams and misc">
        <div className="flex flex-wrap items-center gap-5">
          <StatusBadge status="ready" />
          <StatusBadge status="queued" />
          <StatusBadge status="processing" stage="Analysing" />
          <StatusBadge status="needs_attention" />
          <StatusBadge status="failed" />
          <span className="inline-flex items-center gap-1.5 text-sm">
            <TeamDot team="h" /> Home
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm">
            <TeamDot team="a" /> Away
          </span>
          <Tag>Tag</Tag>
          <Tag dashed>Coming soon</Tag>
          <Kbd>Space</Kbd>
        </div>
        <div className="mt-4 max-w-[480px]">
          <ProgressBar value={0.6} label="Progress" />
        </div>
        <div className="mt-4 grid max-w-[720px] grid-cols-3 gap-3">
          <InlineAlert title="Neutral">Informational message.</InlineAlert>
          <InlineAlert tone="warn" title="Needs attention">Check the file.</InlineAlert>
          <InlineAlert tone="danger" title="Failed">The upload failed.</InlineAlert>
        </div>
      </Section>
    </div>
  )
}
