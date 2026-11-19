import type { CSSProperties, ReactNode } from 'react'
import { Check, Loader2, Lock, Sparkles, TriangleAlert, X, Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import type { Band, MatchStatus, ParityState, Team, Tier, TierStatus } from '@/lib/types'
import { BAND_ORDER, confLevel } from '@/lib/bands'
import { Tooltip } from './overlay'

/* ==========================================================================
   Three visual channels, never merged:
   1. Parity / tier  -> shape + icon + pattern in one stone hue (this file)
   2. Confidence     -> level bar, dashed edge and fade only, no hue
   3. Heat           -> its own gradient, drawn on the pitch only
   Decision-quality bands are the only place traffic-light colours appear.
   ========================================================================== */

/* ---- Parity ---------------------------------------------------------------- */
/* Parity reads as how full the mark is: Full is solid, Degraded is lightly filled, Blocked is empty. */
export function ParityIcon({ state, size = 14, className }: { state: ParityState; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden className={className}>
      {state === 'full' && <rect x="1" y="1" width="12" height="12" rx="2.5" fill="currentColor" />}
      {state === 'degraded' && <rect x="1.6" y="1.6" width="10.8" height="10.8" rx="2" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.2" />}
      {state === 'blocked' && <rect x="1.6" y="1.6" width="10.8" height="10.8" rx="2" stroke="currentColor" strokeWidth="1.2" />}
    </svg>
  )
}

/* Tinted label pills (reference): a low fill in the state's own hue, no hard edge. The icon still
   carries the state by how full it is; Blocked keeps a faint outline because it has no fill. */
const parityTone: Record<ParityState, string> = {
  full: 'border-transparent bg-parity/20 text-parity',
  degraded: 'border-transparent bg-parity/10 text-parity',
  blocked: 'border-hair-strong bg-transparent text-parity-dim',
}

export function ParityBadge({ state, size = 'md', inDevelopment, className }: { state: ParityState; size?: 'sm' | 'md' | 'lg'; inDevelopment?: boolean; className?: string }) {
  const label = t(`parity.${state}`)
  const icon = size === 'lg' ? 16 : size === 'md' ? 12 : 12
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-medium',
        size === 'lg' ? 'h-7 px-2.5 text-sm' : size === 'md' ? 'h-5 pl-1.5 pr-2 text-2xs' : 'h-5 px-1.5 text-2xs',
        parityTone[state],
        className,
      )}
      title={inDevelopment ? `${label}, ${t('tier.in_development')}` : label}
    >
      <ParityIcon state={state} size={icon} />
      <span className={size === 'sm' ? 'sr-only' : undefined}>{label}</span>
    </span>
  )
}

/** A 14-cell strip: one cell per metric, filled the same way as the badge. */
export function ParityStrip({ states, className }: { states: ParityState[]; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-[2px]', className)} aria-hidden>
      {states.map((s, i) => (
        <span
          key={i}
          className={cn(
            'inline-block h-3 w-[5px] rounded-[1px] border',
            s === 'full' && 'border-parity bg-parity',
            s === 'degraded' && 'border-parity bg-parity/30',
            s === 'blocked' && 'border-parity-dim bg-transparent',
          )}
        />
      ))}
    </span>
  )
}

export function ParitySummary({ summary, states, compact }: { summary: { full: number; degraded: number; blocked: number }; states?: ParityState[]; compact?: boolean }) {
  const text = t('parity.summary', { full: summary.full, degraded: summary.degraded, blocked: summary.blocked })
  return (
    <Tooltip content={text}>
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-fg-2" tabIndex={0}>
        {states && !compact ? <ParityStrip states={states} /> : null}
        <span className="sr-only">{text}</span>
        <span aria-hidden className="inline-flex items-center gap-2.5 tabular-nums">
          {(['full', 'degraded', 'blocked'] as const).map((k) => (
            <span key={k} className={cn('inline-flex items-center gap-1', k === 'blocked' ? 'text-parity-dim' : 'text-parity')}>
              <ParityIcon state={k} size={10} />
              <span className="text-fg-2">{t(`parity.count_${k}`, { n: summary[k] })}</span>
            </span>
          ))}
        </span>
      </span>
    </Tooltip>
  )
}

/* ---- Tier ------------------------------------------------------------------ */
export function TierGlyph({ tier, size = 12 }: { tier: Tier; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1 + i * 4} y={9 - (i + 1) * 2.6} width="3" height={(i + 1) * 2.6 + 0.4} rx="0.6" fill={i < tier ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="0.9" opacity={i < tier ? 1 : 0.5} />
      ))}
    </svg>
  )
}

export function TierBadge({ tier, status = 'live', size = 'md', className }: { tier: Tier; status?: TierStatus; size?: 'md' | 'lg'; className?: string }) {
  const dev = status === 'in_development'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 font-medium',
        size === 'lg' ? 'h-7 text-sm' : 'h-5 text-2xs',
        dev ? 'border-dashed border-hair-dashed text-fg-2' : 'border-transparent bg-s2 text-fg-1',
        className,
      )}
      title={dev ? `${t(`tier.hint_${tier}`)}, ${t('tier.in_development')}` : t(`tier.hint_${tier}`)}
    >
      <TierGlyph tier={tier} size={size === 'lg' ? 14 : 12} />
      {t(`tier.name_${tier}`)}
      {dev ? (
        <>
          <Lock className="size-3 text-fg-3" aria-hidden />
          <span className="sr-only">{t('tier.in_development')}</span>
        </>
      ) : null}
    </span>
  )
}

/* ---- Confidence: how solid the reading is. A level bar, no hue, no texture behind text ---- */
/** Maps 0.4 to 1.0 onto an empty-to-full bar, so 0.58 reads clearly shorter than 0.91. */
export const confFrac = (v: number) => Math.min(1, Math.max(0.1, (v - 0.4) / 0.6))

export function ConfidenceGlyph({ value, size = 12 }: { value: number; size?: number }) {
  const w = Math.round(size * 1.8)
  return (
    <span aria-hidden className="relative inline-block shrink-0 overflow-hidden rounded-[2px] border border-[var(--conf-ink)]" style={{ width: w, height: Math.max(6, Math.round(size * 0.55)) }}>
      <span className="absolute inset-y-0 left-0 bg-[var(--conf-ink)]" style={{ width: `${Math.round(confFrac(value) * 100)}%` }} />
    </span>
  )
}

export function ConfidenceMeter({ value, showValue = true, width = 56, className }: { value: number; showValue?: boolean; width?: number; className?: string }) {
  const level = confLevel(value)
  return (
    <span className={cn('inline-flex items-center gap-2', className)} role="img" aria-label={t('conf.aria', { v: value.toFixed(2), level: t(`conf.${level}`) })}>
      <span className="relative h-2 overflow-hidden rounded-[2px] border border-[var(--conf-ink)]" style={{ width }}>
        <span className="absolute inset-y-0 left-0 bg-[var(--conf-ink)]" style={{ width: `${Math.round(confFrac(value) * 100)}%` }} />
      </span>
      {showValue ? <span className="font-mono text-xs tabular-nums text-fg-1">{value.toFixed(2)}</span> : null}
    </span>
  )
}

export function ConfidenceIndicator({ value, className }: { value: number; className?: string }) {
  const level = confLevel(value)
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-fg-2', className)}>
      <ConfidenceGlyph value={value} />
      <span className="font-mono tabular-nums">{value.toFixed(2)}</span>
      <span className="text-fg-3">{t(`conf.${level}`)}</span>
    </span>
  )
}

/* ---- Decision-quality bands (traffic-light colours live here only) ------------ */
const bandClass: Record<Band, string> = {
  low_gain: 'text-dq-low-gain bg-[color-mix(in_srgb,var(--dq-low-gain)_14%,transparent)]',
  partial_gain: 'text-dq-partial-gain bg-[color-mix(in_srgb,var(--dq-partial-gain)_14%,transparent)]',
  most_gain: 'text-dq-most-gain bg-[color-mix(in_srgb,var(--dq-most-gain)_14%,transparent)]',
  full_gain: 'text-dq-full-gain bg-[color-mix(in_srgb,var(--dq-full-gain)_14%,transparent)]',
}

export function BandGlyph({ band, className, size = 12 }: { band: Band; className?: string; size?: number }) {
  const n = BAND_ORDER.indexOf(band) + 1
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className={className}>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={0.5 + i * 3} y={11 - (i + 1) * 2.6} width="2.2" height={(i + 1) * 2.6} rx="0.5" fill="currentColor" opacity={i < n ? 1 : 0.22} />
      ))}
    </svg>
  )
}

export function DqBand({ band, size = 'md', className }: { band: Band; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium', size === 'lg' ? 'h-7 px-3 text-sm' : size === 'md' ? 'h-5 pl-1.5 pr-2 text-2xs' : 'h-4 pl-1 pr-1.5 text-2xs', bandClass[band], className)}>
      <BandGlyph band={band} size={size === 'lg' ? 14 : 12} />
      {t(`band.${band}`)}
    </span>
  )
}

/**
 * Event-only estimate: structurally different from a measured band. Dashed outline,
 * ruled-paper fill, hollow glyph, a range instead of a point, and no traffic-light hue.
 */
export function EstimateBand({ lo, hi, size = 'md', className }: { lo: Band; hi: Band; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const li = BAND_ORDER.indexOf(lo)
  const hiI = BAND_ORDER.indexOf(hi)
  const range = lo === hi ? t(`band.${lo}`) : t('band.range', { lo: t(`band.${lo}`), hi: t(`band.${hi}`) })
  return (
    <span className={cn('pattern-rule inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-hair-dashed font-medium text-fg-1', size === 'lg' ? 'h-7 px-2.5 text-sm' : size === 'md' ? 'h-5 px-1.5 text-2xs' : 'h-4 px-1 text-2xs', className)}>
      <svg width={size === 'lg' ? 14 : 12} height={size === 'lg' ? 14 : 12} viewBox="0 0 12 12" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={0.75 + i * 3} y={11 - (i + 1) * 2.6} width="1.8" height={(i + 1) * 2.6} rx="0.4" fill={i <= li ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="0.8" strokeDasharray={i > li && i <= hiI ? '1.2 1' : undefined} opacity={i <= hiI ? 1 : 0.2} />
        ))}
      </svg>
      <span className="font-mono text-[10px] uppercase tracking-wide text-fg-2">{t('band.est')}</span>
      <span>{range}</span>
    </span>
  )
}

/* ---- AI output marker -------------------------------------------------------- */
export function AiMarker({ detail, className, tone = 'dark' }: { detail?: string; className?: string; tone?: 'dark' | 'print' }) {
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 text-2xs font-medium', tone === 'dark' ? 'border-hair-strong bg-s2 text-fg-2' : 'border-hair-strong text-fg-2', className)}>
      <Sparkles className="size-3" aria-hidden />
      {t('ai.label')}
      {detail ? <span className="font-mono text-fg-3">{detail}</span> : null}
    </span>
  )
}

/* ---- Processing status ------------------------------------------------------- */
export function StatusBadge({ status, stage, className }: { status: MatchStatus; stage?: string; className?: string }) {
  const base = 'inline-flex items-center gap-1.5 whitespace-nowrap text-xs'
  switch (status) {
    case 'ready':
      return (
        <span className={cn(base, 'text-fg-2', className)}>
          <Check className="size-3.5 text-fg-3" aria-hidden />
          {t('status.ready')}
        </span>
      )
    case 'queued':
      return (
        <span className={cn(base, 'text-fg-3', className)}>
          <Clock className="size-3.5" aria-hidden />
          {t('status.queued')}
        </span>
      )
    case 'processing':
      return (
        <span className={cn(base, 'text-accent-text', className)}>
          <Loader2 className="size-3.5 animate-spin-slow" aria-hidden />
          {stage ?? t('status.processing')}
        </span>
      )
    case 'needs_attention':
      return (
        <span className={cn(base, 'text-warn', className)}>
          <TriangleAlert className="size-3.5" aria-hidden />
          {t('status.needs_attention')}
        </span>
      )
    case 'failed':
      return (
        <span className={cn(base, 'text-danger', className)}>
          <X className="size-3.5" aria-hidden />
          {t('status.failed')}
        </span>
      )
  }
}

/* ---- Team marker: a circle, only ever used for teams ---------------------------- */
export function TeamDot({ team, size = 10, className }: { team: Team; size?: number; className?: string }) {
  return <span aria-hidden className={cn('inline-block shrink-0 rounded-full', team === 'h' ? 'bg-home' : 'bg-away', className)} style={{ width: size, height: size }} />
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-hair-strong bg-s2 px-1 font-mono text-2xs text-fg-2">{children}</kbd>
}

export function Tag({ children, className, dashed }: { children: ReactNode; className?: string; dashed?: boolean }) {
  return <span className={cn('inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium text-fg-2', dashed ? 'border-dashed border-hair-strong bg-transparent' : 'border-transparent bg-s2', className)}>{children}</span>
}
