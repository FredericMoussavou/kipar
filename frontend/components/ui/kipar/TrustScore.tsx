import { cn } from '@/lib/utils'
import { Shield } from 'lucide-react'

interface TrustScoreProps {
  score: number
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export default function TrustScore({ score, showLabel = true, size = 'md', className }: TrustScoreProps) {
  const pct = Math.min(Math.max(score, 0), 100)
  const color = pct >= 70 ? 'bg-kipar-green' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <div className="flex items-center gap-1">
          <Shield className={cn('text-kipar-green', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')} />
          <span className={cn('font-medium text-kipar-green', size === 'sm' ? 'text-xs' : 'text-sm')}>
            {Math.round(pct)}
          </span>
        </div>
      )}
      <div className="flex-1 h-1.5 bg-kipar-border rounded-pill overflow-hidden">
        <div
          className={cn('h-full rounded-pill transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
