import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/react-app/components/ui/cn'

type ListRowProps = {
  title: string
  detail?: string
  icon?: LucideIcon
  to?: string
  href?: string
}

const rowClass =
  'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-momentum-flare sm:px-5'

function RowBody({ title, detail, icon: Icon }: Pick<ListRowProps, 'title' | 'detail' | 'icon'>) {
  return (
    <>
      {Icon ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-momentum-flare">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{title}</span>
        {detail ? <span className="mt-0.5 block text-sm leading-snug text-white/65">{detail}</span> : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
    </>
  )
}

export function ListRow({ title, detail, icon, to, href }: ListRowProps) {
  const body = <RowBody title={title} detail={detail} icon={icon} />
  if (to) {
    return (
      <Link to={to} className={rowClass}>
        {body}
      </Link>
    )
  }
  return (
    <a href={href} className={cn(rowClass)}>
      {body}
    </a>
  )
}
