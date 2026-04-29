import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 font-sans font-medium transition-all duration-200 rounded-pill focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]'

  const variants = {
    primary: 'text-white shadow-sm',
    outline: 'border-2 border-green text-green bg-white hover:bg-green-pale',
    ghost: 'text-green bg-transparent hover:bg-green-pale',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  }

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-[15px]',
    lg: 'px-8 py-4 text-base',
  }

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      style={variant === 'primary' ? {backgroundColor: '#1B5E4B'} : undefined}
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
