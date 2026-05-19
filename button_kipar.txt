import { cn } from '@/lib/utils'
import { RED } from '@/lib/theme'
import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary', size = 'md', loading = false,
  fullWidth = false, className, children, disabled, ...props
}, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-pill transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]'

  const variants = {
    primary: 'text-white shadow-red',
    outline: 'border-2 text-k-red bg-white hover:bg-k-red-light',
    ghost:   'text-k-red bg-transparent hover:bg-k-red-light',
    danger:  'bg-red-600 text-white hover:bg-red-700',
  }

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-2.5 text-[14px]',
    lg: 'px-8 py-3.5 text-[15px] tracking-wide',
  }

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      style={variant === 'primary' ? { backgroundColor: RED } : undefined}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
})

Button.displayName = 'Button'
export default Button
