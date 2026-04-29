import { cn } from '@/lib/utils'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg' | 'none'
  shadow?: boolean
}

export default function Card({
  padding = 'md',
  shadow = false,
  className,
  children,
  ...props
}: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  return (
    <div
      className={cn(
        'bg-white border border-kipar-border rounded-lg',
        paddings[padding],
        shadow && 'shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
