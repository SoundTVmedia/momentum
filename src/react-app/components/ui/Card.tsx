import type { ReactNode } from 'react'
import { cn } from '@/react-app/components/ui/cn'

type CardProps = {
  children: ReactNode
  className?: string
  padding?: 'none' | 'md' | 'lg'
  tone?: 'default' | 'accent'
}

const paddingClass = {
  none: '',
  md: 'p-5 sm:p-6',
  lg: 'p-8',
} as const

export function Card({
  children,
  className,
  padding = 'md',
  tone = 'default',
}: CardProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl',
        tone === 'accent' ? 'glass-highlight' : 'glass-panel',
        paddingClass[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}
