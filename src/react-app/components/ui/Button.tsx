import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/react-app/components/ui/cn'

type ButtonVariant = 'primary' | 'secondary' | 'quiet'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  to?: string
  type?: 'button' | 'submit'
  onClick?: () => void
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'momentum-grad-interactive text-white shadow-lg shadow-momentum-ember/20 hover:scale-[1.02]',
  secondary:
    'border border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/15',
  quiet: 'text-momentum-flare hover:text-white',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
}

const quietSizeClass: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  to,
  type = 'button',
  onClick,
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-momentum-flare',
    variantClass[variant],
    variant === 'quiet' ? quietSizeClass[size] : sizeClass[size],
    className,
  )

  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} className={classes} onClick={onClick}>
      {children}
    </button>
  )
}
