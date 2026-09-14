import { ChevronDown } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import { HEADER_ACTION_BUTTON_CLASS } from '@/react-app/components/HeaderGradientPill'
import type { ExtendedMochaUser } from '@/shared/types'
import {
  showBecomeAmbassadorItem,
  showBecomeInfluencerItem,
} from '@/react-app/lib/program-nav'

type BecomeNavDropdownProps = {
  user: ExtendedMochaUser
}

const BECOME_ITEMS = [
  {
    key: 'ambassador' as const,
    label: 'Ambassador',
    path: '/become/ambassador',
    isVisible: showBecomeAmbassadorItem,
  },
  {
    key: 'influencer' as const,
    label: 'Influencer',
    path: '/become/influencer',
    isVisible: showBecomeInfluencerItem,
  },
]

export default function BecomeNavDropdown({ user }: BecomeNavDropdownProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)

  const items = BECOME_ITEMS.filter((item) => item.isVisible(user))
  const isActive = items.some((item) => pathname === item.path)

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setMenuPos(null)
      return
    }
    const update = () => {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setMenuPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      if (!open) return
      const target = e.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('touchstart', onDocDown)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('touchstart', onDocDown)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={rootRef} className="relative hidden md:block shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex shrink-0 items-center justify-center gap-1 bg-transparent ${
          isActive
            ? 'shadow-[inset_0_0_0_1.5px_theme(colors.momentum.flare)] bg-white/10 text-momentum-flare'
            : 'shadow-[inset_0_0_0_1.5px_#fff] hover:bg-white/5'
        } ${HEADER_ACTION_BUTTON_CLASS}`}
      >
        <span>Become...</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed min-w-[10rem] overflow-hidden rounded-lg glass-dropdown shadow-xl z-[200]"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              {items.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    navigate(item.path)
                  }}
                  className={`flex w-full items-center px-3 py-2.5 text-left text-sm text-white hover:bg-white/10 ${
                    index > 0 ? 'border-t border-white/10' : ''
                  } ${pathname === item.path ? 'bg-white/5 text-momentum-flare' : ''}`}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
