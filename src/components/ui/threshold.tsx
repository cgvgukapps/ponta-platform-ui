import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { glossaryEntry } from '@/api'
import { t } from '@/i18n'
import { Popover, PopoverContent, PopoverTrigger } from './overlay'

/**
 * A named threshold such as "high pressure (at or above 0.7)". Always clickable: opens the
 * definition so no number in the product is unexplained.
 */
export function Threshold({ id, children, className }: { id: string; children?: ReactNode; className?: string }) {
  const g = glossaryEntry(id)
  if (!g) return <>{children}</>
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn('rounded-[2px] border-b border-dotted border-fg-3 text-left text-fg-1 hover:border-accent hover:text-accent-text', className)}
          aria-label={`${g.term}: ${t('threshold.open')}`}
        >
          {children ?? g.term}
          {!children && g.short ? <span className="text-fg-3"> ({g.short})</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px]">
        <p className="text-xs font-medium text-fg-4">{t('threshold.label')}</p>
        <p className="mt-1 text-sm font-medium text-fg-1">{g.term}</p>
        {g.short ? <p className="mt-0.5 font-mono text-xs tabular-nums text-fg-2">{g.short}</p> : null}
        <p className="mt-2 text-sm text-fg-2">{g.definition}</p>
      </PopoverContent>
    </Popover>
  )
}
