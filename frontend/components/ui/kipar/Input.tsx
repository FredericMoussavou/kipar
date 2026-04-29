import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef, ReactNode } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  leftIcon,
  rightIcon,
  className,
  ...props
}, ref) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-kipar-text">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-kipar-muted">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-kipar-input border border-kipar-border rounded-md px-4 py-3 text-[15px] text-kipar-text placeholder:text-kipar-light',
            'focus:outline-none focus:border-green focus:ring-2 focus:ring-green/10',
            'transition-all duration-200',
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            error && 'border-red-400 focus:border-red-400 focus:ring-red-100',
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-kipar-muted cursor-pointer">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          {error}
        </p>
      )}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
