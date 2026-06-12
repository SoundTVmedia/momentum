import { Search, LogOut, Bell, Shield, Handshake } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@getmocha/users-service/react'
import { useLocation, useNavigate } from 'react-router'
import { useUnreadNotificationCount } from '@/react-app/contexts/NotificationsContext'
import NotificationAlertBadge from './NotificationAlertBadge'
import NotificationPanel from './NotificationPanel'
import { hasUnreadNotifications } from '@/react-app/lib/notification-badge'
import ClipModal from './ClipModal'
import UserAvatar from './UserAvatar'
import AdvancedSearchDropdown from './AdvancedSearchDropdown'
import type { ClipWithUser, ExtendedMochaUser } from '@/shared/types'
import { useAdvancedSearch } from '@/react-app/hooks/useAdvancedSearch'
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext'
import { HEADER_ACTION_BUTTON_CLASS } from '@/react-app/components/HeaderGradientPill'
import BecomeNavDropdown from '@/react-app/components/BecomeNavDropdown'
import { showBecomeNav, showSponsorNav } from '@/react-app/lib/program-nav'

export default function Header() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const hideHeaderSearch = isHome
  const { hideBottomNav: hideSiteChrome } = useMobileChrome()
  const { user, logout } = useAuth()
  const extendedUser = user as ExtendedMochaUser | null
  const oauthUser = user as { google_user_data?: { picture?: string; name?: string } } | null
  const unreadCount = useUnreadNotificationCount()
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const { results, loading, revalidating, scheduleSearch, cancelSearch, reset } =
    useAdvancedSearch()
  const [headerClipModal, setHeaderClipModal] = useState<{
    clip: ClipWithUser
    feed: ClipWithUser[]
  } | null>(null)
  const searchDropdownRef = useRef<HTMLDivElement | null>(null)
  
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const el = searchDropdownRef.current
      if (!el || !showSearchResults) return
      if (e.target instanceof Node && !el.contains(e.target)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [showSearchResults])

  const closeSearchUi = useCallback(() => {
    setShowSearchResults(false)
    setSearchQuery('')
    reset()
  }, [reset])

  const handleSearchInput = (query: string) => {
    setSearchQuery(query)
    if (query.trim().length >= 2) {
      setShowSearchResults(true)
      scheduleSearch(query)
    } else {
      cancelSearch()
      setShowSearchResults(false)
    }
  }

  const goToDiscoverSearch = () => {
    const q = searchQuery.trim()
    if (!q) return
    closeSearchUi()
    navigate(`/discover?q=${encodeURIComponent(q)}`)
  }

  const handleHeaderSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    goToDiscoverSearch()
  }

  return (
    <>
    {!hideSiteChrome ? (
    <header className="glass-chrome border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <button 
            onClick={() => navigate('/')}
            className="flex items-center space-x-1.5 sm:space-x-2 md:space-x-4 min-w-0"
          >
            <div className="text-lg sm:text-xl md:text-2xl font-headline bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember bg-clip-text text-transparent truncate">
              FEEDBACK
            </div>
          </button>

          <div className="flex items-center justify-end gap-1 sm:gap-2 md:gap-4 min-w-0">
            <button
              type="button"
              onClick={() => navigate(showSponsorNav(extendedUser) ? '/sponsors' : '/partner')}
              className={`hidden md:inline-flex shrink-0 items-center justify-center gap-1.5 bg-transparent ${
                pathname === '/partner' || pathname === '/sponsors'
                  ? 'shadow-[inset_0_0_0_1.5px_theme(colors.momentum.flare)] bg-white/10 text-momentum-flare'
                  : 'shadow-[inset_0_0_0_1.5px_#fff] hover:bg-white/5'
              } ${HEADER_ACTION_BUTTON_CLASS}`}
            >
              <Handshake className="h-3.5 w-3.5" aria-hidden />
              <span>{showSponsorNav(extendedUser) ? 'Sponsors' : 'Partner With Us'}</span>
            </button>
            {user && showBecomeNav(extendedUser) ? (
              <BecomeNavDropdown user={extendedUser!} />
            ) : null}
            <div
              className={`relative z-[100] hidden lg:block ${hideHeaderSearch ? 'lg:hidden' : ''}`}
              ref={searchDropdownRef}
            >
              <form onSubmit={handleHeaderSearchSubmit} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
                  placeholder="Search clips, artists, venues..."
                  className="glass-input w-48 xl:w-64 pl-9 pr-3 py-2 rounded-xl text-white placeholder-gray-400 text-sm"
                  aria-autocomplete="list"
                  aria-expanded={showSearchResults}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </form>

              <AdvancedSearchDropdown
                query={searchQuery}
                open={showSearchResults}
                loading={loading}
                revalidating={revalidating}
                results={results}
                onClose={closeSearchUi}
                onDiscoverAll={goToDiscoverSearch}
                onClipSelect={(clip, feed) => setHeaderClipModal({ clip, feed })}
                variant="header"
              />
            </div>

            {user ? (
              <div className="flex items-center space-x-0.5 sm:space-x-1 md:space-x-2">
                <button
                  onClick={() => navigate('/upload')}
                  className={`hidden md:block momentum-grad-interactive shadow-lg shadow-momentum-ember/35 ${HEADER_ACTION_BUTTON_CLASS}`}
                >
                  Share Your Moment
                </button>
                <button
                  onClick={() => navigate(`/users/${user.id}`)}
                  className="hidden md:inline-flex items-center justify-center p-0.5 sm:p-1 rounded-full text-gray-400 hover:text-white transition-colors ring-2 ring-transparent hover:ring-white/20 tap-feedback"
                  title="Your profile"
                  type="button"
                >
                  <UserAvatar
                    imageUrl={
                      extendedUser?.profile?.profile_image_url ??
                      oauthUser?.google_user_data?.picture ??
                      null
                    }
                    displayName={
                      extendedUser?.profile?.display_name ??
                      oauthUser?.google_user_data?.name ??
                      null
                    }
                    seed={user?.id}
                    sizeClass="w-8 h-8 sm:w-9 sm:h-9"
                    letterClassName="text-xs sm:text-sm font-semibold"
                  />
                </button>
                <div className="relative hidden md:block">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative p-1.5 sm:p-2 text-gray-400 hover:text-white transition-colors group"
                    title="Notifications"
                    type="button"
                  >
                    <Bell
                      className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform ${hasUnreadNotifications(unreadCount) ? 'animate-pulse' : ''} group-hover:scale-110`}
                    />
                    <NotificationAlertBadge variant="header" />
                  </button>

                  {showNotifications && (
                    <NotificationPanel onClose={() => setShowNotifications(false)} />
                  )}
                </div>
                {(extendedUser?.profile?.is_admin === 1 ||
                  extendedUser?.profile?.is_superadmin === 1) && (
                  <button
                    onClick={() => navigate('/admin')}
                    className="hidden md:block p-1.5 sm:p-2 text-gray-400 hover:text-momentum-rose transition-colors"
                    title="Admin Dashboard"
                    type="button"
                  >
                    <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
                <button
                  onClick={logout}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-white transition-colors"
                  title="Sign out"
                  type="button"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/auth')}
                className="px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 momentum-grad-interactive rounded-lg font-bold text-white hover:scale-105 transition-transform text-xs sm:text-sm md:text-base whitespace-nowrap shadow-lg shadow-momentum-flare/35"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
    ) : null}
    {headerClipModal ? (
      <ClipModal
        clip={headerClipModal.clip}
        onClose={() => setHeaderClipModal(null)}
        feedNavigation={
          headerClipModal.feed.length > 1
            ? {
                clips: headerClipModal.feed,
                onChangeClip: (c) =>
                  setHeaderClipModal((m) => (m ? { ...m, clip: c } : null)),
              }
            : null
        }
      />
    ) : null}
    </>
  )
}
