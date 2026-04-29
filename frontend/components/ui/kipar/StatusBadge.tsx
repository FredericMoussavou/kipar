'use client'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/useTranslation'

const STATUS_CLASSES: Record<string, string> = {
  awaiting_receiver: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-50 text-yellow-700',
  accepted: 'bg-green-light text-green',
  refused: 'bg-red-50 text-red-600',
  paid: 'bg-green-light text-green',
  in_transit: 'bg-blue-50 text-blue-700',
  delivered: 'bg-green-light text-green',
  disputed: 'bg-red-50 text-red-600',
  refunded: 'bg-gray-100 text-gray-600',
  open: 'bg-green-light text-green',
  full: 'bg-gray-100 text-gray-600',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation()
  const label = t.statuses[status as keyof typeof t.statuses] || status
  const cls = STATUS_CLASSES[status] || 'bg-gray-100 text-gray-600'

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium',
      cls,
      className
    )}>
      {label}
    </span>
  )
}
