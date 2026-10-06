import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[box-shadow,background-color,border-color,color,transform] duration-300 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // same gradient, glow and sheen as the landing page's call-to-action
        default:
          'app-btn-primary bg-gradient-to-br from-primary to-ring text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.7)] hover:shadow-[0_14px_44px_-8px_hsl(var(--primary)/0.85)]',
        outline:
          'border border-foreground/15 bg-card/50 backdrop-blur-md hover:border-primary/60 hover:bg-accent/80',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        sm: 'h-8 px-3.5',
        md: 'h-10 px-5',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'
