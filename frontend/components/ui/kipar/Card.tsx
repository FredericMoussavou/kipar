import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

export default function Card({ padding = 'md', className, children, ...props }: CardProps) {
  const paddings = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' }
  return (
    <div
      className={cn('bg-white border border-k-border rounded-kipar shadow-kipar', paddings[padding], className)}
      {...props}
    >
      {children}
    </div>
  )
}
