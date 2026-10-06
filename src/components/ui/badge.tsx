import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      neutral: 'bg-foreground/[0.06] text-foreground',
      primary: 'bg-accent text-accent-foreground',
      outline: 'border border-foreground/15 bg-card/40 text-muted-foreground backdrop-blur-md',
    },
  },
  defaultVariants: { variant: 'neutral' },
})

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...p }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...p} />
)
