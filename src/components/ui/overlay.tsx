import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import * as HoverCard from '@radix-ui/react-hover-card'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'

export const TooltipProvider = TooltipPrimitive.Provider

export function Tooltip({ content, children, side = 'top', asChild = true }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right'; asChild?: boolean }) {
  return (
    <TooltipPrimitive.Root delayDuration={250}>
      <TooltipPrimitive.Trigger asChild={asChild}>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className="z-[60] max-w-[280px] rounded-md border border-hair-strong bg-s3 px-2.5 py-1.5 text-xs text-fg-1">
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export function PopoverContent({ children, className, align = 'start', side = 'bottom' }: { children: ReactNode; className?: string; align?: 'start' | 'center' | 'end'; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content align={align} side={side} sideOffset={6} className={cn('z-50 w-72 rounded-xl bg-s2 p-3 text-sm', className)}>
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

export const HoverPreview = HoverCard.Root
export const HoverPreviewTrigger = HoverCard.Trigger
export function HoverPreviewContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <HoverCard.Portal>
      <HoverCard.Content side="top" sideOffset={8} collisionPadding={12} className={cn('z-[60] rounded-xl bg-s2 p-2', className)}>
        {children}
      </HoverCard.Content>
    </HoverCard.Portal>
  )
}

export const Menu = Dropdown.Root
export const MenuTrigger = Dropdown.Trigger
export function MenuContent({ children, className, align = 'start', side }: { children: ReactNode; className?: string; align?: 'start' | 'center' | 'end'; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content align={align} side={side} sideOffset={6} className={cn('z-50 min-w-48 rounded-xl bg-s2 p-1 text-sm', className)}>
        {children}
      </Dropdown.Content>
    </Dropdown.Portal>
  )
}
export function MenuItem({ children, onSelect, disabled, danger, className }: { children: ReactNode; onSelect?: () => void; disabled?: boolean; danger?: boolean; className?: string }) {
  return (
    <Dropdown.Item onSelect={onSelect} disabled={disabled} className={cn('flex h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 text-fg-1 outline-none data-[highlighted]:bg-s3 data-[disabled]:opacity-45', danger && 'text-danger', className)}>
      {children}
    </Dropdown.Item>
  )
}
export const MenuSeparator = () => <Dropdown.Separator className="my-1 h-px bg-hair" />
export const MenuLabel = ({ children }: { children: ReactNode }) => <Dropdown.Label className="px-2 py-1 text-xs font-medium text-fg-4">{children}</Dropdown.Label>

export function Modal({ open, onOpenChange, title, description, children, footer, width = 480 }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode; width?: number }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Dialog.Content style={{ width }} className="anim-fade-up fixed left-1/2 top-1/2 z-50 max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-s1">
          <div className="flex items-start justify-between gap-4 border-b border-hair p-4">
            <div>
              <Dialog.Title className="text-md font-semibold text-fg-1">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm text-fg-3">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close aria-label={t('common.close')} className="rounded-sm p-1 text-fg-3 hover:bg-s2 hover:text-fg-1">
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          {children ? <div className="p-4">{children}</div> : null}
          {footer ? <div className="flex justify-end gap-2 border-t border-hair p-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Drawer({ open, onOpenChange, title, description, children, width = 440 }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; width?: number }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Dialog.Content style={{ width }} className="fixed inset-y-0 right-0 z-50 flex max-w-full flex-col border-l border-hair-strong bg-s1">
          <div className="flex items-start justify-between gap-4 border-b border-hair p-4">
            <div>
              <Dialog.Title className="text-md font-semibold text-fg-1">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-1 text-sm text-fg-3">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close aria-label={t('common.close')} className="rounded-sm p-1 text-fg-3 hover:bg-s2 hover:text-fg-1">
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
