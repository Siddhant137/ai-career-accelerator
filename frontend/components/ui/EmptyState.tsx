import Link from 'next/link'
import { LucideIcon } from 'lucide-react'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="card empty-state text-center py-16 px-6">
      <div className="empty-state-icon mx-auto mb-4">
        <Icon size={36} strokeWidth={1.5} />
      </div>
      <p className="font-display font-semibold text-lg text-slate-300 mb-2">{title}</p>
      <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-secondary inline-flex mt-6 w-auto px-6">
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
