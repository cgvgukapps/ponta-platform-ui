import type { ReactNode } from 'react'
import { X, Check, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useApp } from '@/state/app'
import { t } from '@/i18n'

export function Toaster() {
  const { toasts, dismissToast } = useApp()
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-80 flex-col gap-2">
      {toasts.map((x) => (
        <div key={x.id} role="status" className="anim-fade-up pointer-events-auto flex items-start gap-2.5 rounded-xl bg-s2 p-3">
          {x.tone === 'error' ? <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden /> : <Check className="mt-0.5 size-4 shrink-0 text-fg-2" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg-1">{x.title}</p>
            {x.body ? <p className="mt-0.5 text-xs text-fg-3">{x.body}</p> : null}
          </div>
          <button onClick={() => dismissToast(x.id)} aria-label={t('common.dismiss')} className="rounded-sm p-0.5 text-fg-3 hover:text-fg-1">
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />
}

export function EmptyState({ icon, title, body, actions, className }: { icon?: ReactNode; title: string; body: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center', className)}>
      {icon ? <div className="flex size-10 items-center justify-center rounded-xl bg-s2 text-fg-2">{icon}</div> : null}
      <h2 className="text-md font-semibold text-fg-1">{title}</h2>
      <p className="text-sm text-fg-3">{body}</p>
      {actions ? <div className="mt-1 flex gap-2">{actions}</div> : null}
    </div>
  )
}

export function InlineAlert({ tone = 'neutral', title, children, icon, className }: { tone?: 'neutral' | 'danger' | 'warn'; title?: string; children?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      className={cn(
        'flex items-start gap-2.5 rounded-md border p-3 text-sm',
        tone === 'danger' && 'border-[color-mix(in_srgb,var(--danger)_40%,transparent)] bg-danger-tint',
        tone === 'warn' && 'border-[color-mix(in_srgb,var(--warn)_40%,transparent)] bg-warn-tint',
        tone === 'neutral' && 'border-hair-strong bg-s2',
        className,
      )}
    >
      {icon ? <span className={cn('mt-0.5 shrink-0', tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-fg-3')}>{icon}</span> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium text-fg-1">{title}</p> : null}
        {children ? <div className={cn('text-fg-2', title && 'mt-0.5')}>{children}</div> : null}
      </div>
    </div>
  )
}

/** Stage indicator for processing: five named stages, the current one animates. */
export function StageList({ stages, current, progress = 0, failedAt }: { stages: string[]; current: number; progress?: number; failedAt?: number }) {
  return (
    <ol className="flex flex-col gap-0" aria-label="Processing stages">
      {stages.map((s, i) => {
        const done = i < current
        const active = i === current && failedAt === undefined
        const failed = failedAt === i
        return (
          <li key={s} className="relative flex items-start gap-3 pb-4 last:pb-0" aria-current={active ? 'step' : undefined}>
            {i < stages.length - 1 ? <span aria-hidden className={cn('absolute left-[7px] top-4 h-full w-px', done ? 'bg-fg-3' : 'bg-hair-strong')} /> : null}
            <span className={cn('relative z-10 mt-0.5 flex size-4 items-center justify-center rounded-full border text-2xs', done ? 'border-fg-2 bg-fg-2 text-canvas' : failed ? 'border-danger bg-danger-tint text-danger' : active ? 'border-accent bg-s1' : 'border-hair-strong bg-s1')}>
              {done ? <Check className="size-2.5" aria-hidden /> : active ? <span className="size-1.5 rounded-full bg-accent" /> : failed ? <X className="size-2.5" aria-hidden /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm', done || active ? 'text-fg-1' : 'text-fg-4')}>{s}</p>
              {active ? (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-s3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label={s}>
                  <div className="h-full rounded-full bg-accent transition-[width] duration-[var(--dur-slow)]" style={{ width: `${Math.max(6, progress * 100)}%` }} />
                </div>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-s3', className)} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <div className="h-full rounded-full bg-accent transition-[width] duration-[var(--dur-slow)]" style={{ width: `${value * 100}%` }} />
    </div>
  )
}
