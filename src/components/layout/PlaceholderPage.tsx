import type { LucideIcon } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from './PageHeader'

interface Props {
  title: string
  description: string
  phase: number
  icon: LucideIcon
}

export function PlaceholderPage({ title, description, phase, icon }: Props) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState icon={icon} title="Coming soon" description={`This section is built in Phase ${phase}.`} />
    </>
  )
}
