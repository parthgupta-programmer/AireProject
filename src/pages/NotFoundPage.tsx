import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { buttonVariants } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="That address doesn’t exist."
      action={<Link to="/" className={buttonVariants({ size: 'sm' })}>Back to overview</Link>}
    />
  )
}
