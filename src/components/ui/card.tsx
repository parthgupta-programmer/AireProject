import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Frosted-glass surface, the same card look as the landing page. */
export const Card = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('app-glass rounded-2xl', className)} {...p} />
)
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-5 pt-5', className)} {...p} />
)
export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn('font-display text-base font-semibold tracking-tight text-foreground/80', className)} {...p} />
)
export const CardContent = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-5', className)} {...p} />
)
