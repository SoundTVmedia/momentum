import { Menu } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import type { ExtendedMochaUser } from '@/shared/types'
import { showSponsorNav } from '@/react-app/lib/program-nav'

type MobileNavMoreMenuProps = {
  user: ExtendedMochaUser | null
}

export default function MobileNavMoreMenu({ user }: MobileNavMoreMenuProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const partnerPath = showSponsorNav(user) ? '/sponsors' : '/partner'
  const partnerLabel = showSponsorNav(user) ? 'Sponsors' : 'Partner With Us'

  const items = [
    { label: 'Artist Hub', path: '/artist-hub' },
    { label: 'Venue Hub', path: '/venue-hub' },
    { label: partnerLabel, path: partnerPath },
  ]
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

  return (
    <div ref={rootRef} className="relative md:hidden shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More"
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-white transition-colors ${
          isActive || open ? 'bg-white/15 text-momentum-flare' : 'hover:bg-white/10'
        }`}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed min-w-[12rem] overflow-hidden rounded-lg glass-dropdown shadow-xl z-[200]"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              {items.map((item, index) => (
                <button
                  key={item.path}
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
