import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-foreground/15 bg-card/50 px-3.5 text-sm backdrop-blur-md transition-[border-color,box-shadow] duration-300 placeholder:text-muted-foreground hover:border-foreground/25 focus-visible:border-primary/60 focus-visible:shadow-[0_0_0_4px_hsl(var(--primary)/0.12)] disabled:opacity-50 aria-[invalid=true]:border-aqi-very-poor/70',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
