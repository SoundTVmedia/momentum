import type { ReactNode } from 'react'
import { cn } from '@/react-app/components/ui/cn'

type PageProps = {
  children: ReactNode
  className?: string
}

export function Page({ children, className }: PageProps) {
  return <div className={cn('min-h-screen text-white', className)}>{children}</div>
}

export function PageBody({ children, className }: PageProps) {
  return (
    <div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  )
}
