import { RED } from '@/lib/theme'
import { cn } from '@/lib/utils'

interface TrustScoreProps {
  score: number
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

function getTrustColor(score: number): string {
  if (score >= 75) return '#16A34A'
  if (score >= 50) return '#4ADE80'
  if (score >= 30) return '#F59E0B'
  return RED
}

export default function TrustScore({ score, showLabel = true, size = 'md', className }: TrustScoreProps) {
  const pct = Math.min(Math.max(score, 0), 100)
  const color = getTrustColor(pct)

  const gradient = pct >= 75
    ? 'linear-gradient(90deg, #F59E0B 0%, #4ADE80 60%, #16A34A 100%)'
    : pct >= 50
    ? 'linear-gradient(90deg, #F59E0B 0%, #4ADE80 100%)'
    : pct >= 30
    ? 'linear-gradient(90deg, ' + RED + ' 0%, #F59E0B 100%)'
    : 'linear-gradient(90deg, ' + RED + ' 0%, #F97316 100%)'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <span className={cn('font-medium min-w-[28px]', size === 'sm' ? 'text-[10px]' : 'text-xs')}
          style={{ color }}>
          Trust
        </span>
      )}
      <div className={cn('flex-1 bg-k-sand rounded-pill overflow-hidden', size === 'sm' ? 'h-[3px]' : 'h-[4px]')}>
        <div
          className="h-full rounded-pill transition-all duration-500"
          style={{ width: `${pct}%`, background: gradient }}
        />
      </div>
      <span className={cn('font-bold min-w-[24px] text-right', size === 'sm' ? 'text-[10px]' : 'text-xs')}
        style={{ color }}>
        {Math.round(pct)}
      </span>
    </div>
  )
}
