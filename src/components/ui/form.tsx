import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { Check, ChevronDown, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

// Focus is the field's own 1 px edge turning Ponta blue, the same as the Ask composer (no outer ring).
export const inputStyles =
  'h-9 w-full rounded-lg border border-transparent bg-s2 px-3 text-sm text-fg-1 placeholder:text-fg-4 transition-colors duration-[var(--dur-base)] hover:bg-s3 focus:border-accent focus:bg-s2 disabled:opacity-45 disabled:cursor-not-allowed aria-[invalid=true]:border-danger data-[force=hover]:border-hair-hover data-[force=focus]:border-accent'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { force?: 'hover' | 'focus' }>(function Input({ className, force, ...p }, ref) {
  return <input ref={ref} className={cn(inputStyles, className)} data-force={force} {...p} />
})

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode; htmlFor?: string }) {
  const auto = useId()
  const id = htmlFor ?? auto
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-fg-2">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
          <TriangleAlert className="size-3.5" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-4">{hint}</p>
      ) : null}
    </div>
  )
}

export interface Option {
  value: string
  label: string
}
export function Select({ value, onValueChange, options, placeholder, className, 'aria-label': ariaLabel, disabled, size = 'md' }: { value: string; onValueChange: (v: string) => void; options: Option[]; placeholder?: string; className?: string; 'aria-label'?: string; disabled?: boolean; size?: 'sm' | 'md' }) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-lg border border-transparent bg-s2 px-3 text-sm text-fg-1 transition-colors hover:bg-s3 focus-visible:border-accent data-[state=open]:border-accent disabled:opacity-45 data-[placeholder]:text-fg-3',
          size === 'sm' ? 'h-7 text-xs' : 'h-8',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="size-3.5 text-fg-3" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={4} className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl bg-s2 p-1 text-sm">
          <SelectPrimitive.Viewport>
            {options.map((o) => (
              <SelectPrimitive.Item key={o.value} value={o.value} className="relative flex h-7 cursor-default select-none items-center rounded-sm pl-7 pr-2 text-fg-1 outline-none data-[highlighted]:bg-s3 data-[disabled]:opacity-45">
                <SelectPrimitive.ItemIndicator className="absolute left-2">
                  <Check className="size-3.5 text-accent-text" aria-hidden />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export function Checkbox({ checked, onCheckedChange, label, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; id?: string }) {
  const auto = useId()
  const cid = id ?? auto
  return (
    <div className="flex items-center gap-2">
      <CheckboxPrimitive.Root id={cid} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} className="flex size-4 items-center justify-center rounded-sm border border-control bg-s1 transition-colors hover:border-hair-hover data-[state=checked]:border-accent data-[state=checked]:bg-accent-fill">
        <CheckboxPrimitive.Indicator>
          <Check className="size-3 text-on-accent" aria-hidden />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <label htmlFor={cid} className="text-sm text-fg-2">
        {label}
      </label>
    </div>
  )
}

export function Switch({ checked, onCheckedChange, label, id, hideLabel }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; id?: string; hideLabel?: boolean }) {
  const auto = useId()
  const sid = id ?? auto
  return (
    <span className="flex items-center gap-3">
      <SwitchPrimitive.Root id={sid} checked={checked} onCheckedChange={onCheckedChange} className="relative h-5 w-9 shrink-0 rounded-full border border-transparent bg-s3 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent-fill">
        <SwitchPrimitive.Thumb className="block size-3 translate-x-px rounded-full bg-fg-1 transition-transform duration-[var(--dur-base)] data-[state=checked]:translate-x-[13px]" />
      </SwitchPrimitive.Root>
      <label htmlFor={sid} className={hideLabel ? 'sr-only' : 'text-sm text-fg-1'}>
        {label}
      </label>
    </span>
  )
}
