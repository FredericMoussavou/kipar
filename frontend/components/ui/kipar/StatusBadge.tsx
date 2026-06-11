'use client'
import { useTranslation } from '@/hooks/useTranslation'

const STATUS_STYLES: Record<string, { background: string; color: string }> = {
  awaiting_receiver: { background: 'rgba(255,255,255,0.9)', color: '#6B6560' },
  pending:           { background: '#FFF8E1', color: '#B45309' },
  accepted:          { background: '#ECFDF5', color: '#059669' },
  refused:           { background: '#FEF2F2', color: '#DC2626' },
  paid:              { background: '#ECFDF5', color: '#059669' },
  in_transit:        { background: '#EFF6FF', color: '#1D4ED8' },
  delivered:         { background: '#ECFDF5', color: '#059669' },
  disputed:          { background: '#FEF2F2', color: '#DC2626' },
  pickup_failed:     { background: '#FFF7ED', color: '#C2410C' },
  refunded:          { background: 'rgba(255,255,255,0.9)', color: '#6B6560' },
  open:              { background: '#ECFDF5', color: '#059669' },
  full:              { background: 'rgba(255,255,255,0.9)', color: '#6B6560' },
  expired:           { background: 'rgba(255,255,255,0.9)', color: '#6B6560' },
}

export default function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const label = t.statuses[status as keyof typeof t.statuses] || status
  const style = STATUS_STYLES[status] || { background: 'rgba(255,255,255,0.9)', color: '#6B6560' }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      background: style.background,
      color: style.color,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}