import type { ReactNode } from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/cn'

export const Tabs = TabsPrimitive.Root
export function TabsList({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <TabsPrimitive.List aria-label={label} className={cn('flex items-center gap-1 border-b border-hair', className)}>
      {children}
    </TabsPrimitive.List>
  )
}
export function TabsTrigger({ value, children, className, count }: { value: string; children: ReactNode; className?: string; count?: number | string }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        '-mb-px inline-flex h-9 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-sm text-fg-3 transition-colors duration-[var(--dur-base)] hover:text-fg-1 data-[state=active]:border-fg-1 data-[state=active]:text-fg-1 disabled:opacity-45',
        className,
      )}
    >
      {children}
      {count !== undefined ? <span className="rounded-sm bg-s3 px-1 font-mono text-2xs text-fg-2">{count}</span> : null}
    </TabsPrimitive.Trigger>
  )
}
export const TabsContent = TabsPrimitive.Content

export function Segmented<T extends string>({ value, onValueChange, options, label, size = 'md' }: { value: T; onValueChange: (v: T) => void; options: { value: T; label: ReactNode; ariaLabel?: string }[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <ToggleGroup.Root type="single" value={value} onValueChange={(v) => v && onValueChange(v as T)} aria-label={label} className="inline-flex rounded-full bg-s1 p-1">
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          aria-label={o.ariaLabel}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-full px-3 text-fg-3 transition-colors duration-[var(--dur-fast)] hover:text-fg-1 data-[state=on]:bg-s3 data-[state=on]:text-fg-1',
            size === 'sm' ? 'h-7 text-xs' : 'h-8 text-sm',
          )}
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
