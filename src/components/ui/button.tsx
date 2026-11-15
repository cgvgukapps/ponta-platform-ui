import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Buttons. Primary uses a darker blue fill so white text passes AA (6.4:1); the brand blue
 * #1E76FA is kept for focus rings and graphics. `data-force` lets the component sheet show
 * hover, active and focus states statically.
 */
export const buttonStyles = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border font-medium transition-colors duration-[var(--dur-base)] disabled:pointer-events-none disabled:opacity-45 aria-busy:cursor-progress data-[force=focus]:outline-2 data-[force=focus]:outline-offset-2 data-[force=focus]:outline-accent select-none',
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-accent-fill text-on-accent hover:bg-accent-fill-hover active:bg-accent-fill-active data-[force=hover]:bg-accent-fill-hover data-[force=active]:bg-accent-fill-active',
        secondary:
          'border-hair-strong bg-s2 text-fg-1 hover:bg-s3 hover:border-[var(--hairline-strong)] active:bg-s1 data-[force=hover]:bg-s3 data-[force=active]:bg-s1',
        ghost: 'border-transparent bg-transparent text-fg-2 hover:bg-s2 hover:text-fg-1 active:bg-s3 data-[force=hover]:bg-s2 data-[force=hover]:text-fg-1 data-[force=active]:bg-s3',
        destructive:
          'border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-danger-tint text-danger hover:bg-[color-mix(in_srgb,var(--danger)_20%,transparent)] active:bg-[color-mix(in_srgb,var(--danger)_28%,transparent)] data-[force=hover]:bg-[color-mix(in_srgb,var(--danger)_20%,transparent)] data-[force=active]:bg-[color-mix(in_srgb,var(--danger)_28%,transparent)]',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3 text-sm',
        lg: 'h-10 px-4 text-base',
        icon: 'h-8 w-8 p-0',
        'icon-sm': 'h-7 w-7 p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {
  loading?: boolean
  force?: 'hover' | 'active' | 'focus'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, loading, disabled, children, force, ...props }, ref) {
  return (
    <button ref={ref} className={cn(buttonStyles({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} data-force={force} {...props}>
      {loading ? <Loader2 className="size-3.5 animate-spin-slow" aria-hidden /> : null}
      {children}
    </button>
  )
})
