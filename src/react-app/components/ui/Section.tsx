import type { ReactNode } from 'react'
import { cn } from '@/react-app/components/ui/cn'

type SectionProps = {
  id?: string
  title?: ReactNode
  description?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
  dataTour?: string
}

export function Section({
  id,
  title,
  description,
  action,
  children,
  className = 'mb-6 md:mb-5',
  dataTour,
}: SectionProps) {
  const hasHeader = Boolean(title || description || action)

  return (
    <section id={id} className={cn('scroll-mt-28', className)}>
      {hasHeader ? (
        <div
          className="mb-3 flex items-start justify-between gap-3 md:mb-4"
          data-tour={dataTour}
        >
          <div className="min-w-0">
            {title ? <h2 className="fb-section-title">{title}</h2> : null}
            {description ? <p className="fb-section-subtitle mt-1">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
