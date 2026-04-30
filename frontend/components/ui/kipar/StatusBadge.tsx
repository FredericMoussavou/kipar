'use client'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/useTranslation'

const STATUS_CLASSES: Record<string, string> = {
  awaiting_receiver: 'bg-k-sand text-k-charcoal-2',
  pending:           'bg-amber-50 text-amber-700',
  accepted:          'bg-emerald-50 text-emerald-700',
  refused:           'bg-red-50 text-red-600',
  paid:              'bg-emerald-50 text-emerald-700',
  in_transit:        'bg-blue-50 text-blue-700',
  delivered:         'bg-emerald-50 text-emerald-700',
  disputed:          'bg-red-50 text-red-600',
  refunded:          'bg-k-sand text-k-charcoal-2',
  open:              'bg-emerald-50 text-emerald-700',
  full:              'bg-k-sand text-k-charcoal-2',
}

export default function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useTranslation()
  const label = t.statuses[status as keyof typeof t.statuses] || status
  const cls = STATUS_CLASSES[status] || 'bg-k-sand text-k-charcoal-2'
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium', cls, className)}>
      {label}
    </span>
  )
}
