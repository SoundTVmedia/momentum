import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@getmocha/users-service/react'
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonSearchbar,
  IonToolbar,
} from '@ionic/react'
import { logOutOutline, notificationsOutline, peopleOutline, shieldOutline } from 'ionicons/icons'
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
import BecomeNavDropdown from '@/react-app/components/BecomeNavDropdown'
import PoweredByJamBase from '@/react-app/components/PoweredByJamBase'
import { isAdminUser, showBecomeNav, showSponsorNav } from '@/react-app/lib/program-nav'

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

  return (
    <>
    {!hideSiteChrome ? (
    <IonHeader className="app-top-header ion-no-border">
      <IonToolbar className="app-toolbar">
        <div className="flex w-full min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5 md:gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="min-w-0"
            >
              <div className="truncate whitespace-nowrap text-lg font-headline bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-ember bg-clip-text text-transparent sm:text-xl md:text-2xl">
                FEEDBACK
              </div>
            </button>
            <PoweredByJamBase variant="nav" />
          </div>

          <div className="flex min-w-0 items-center justify-end gap-0.5 sm:gap-1 md:gap-2">
            <IonButton
              fill="clear"
              className="hidden md:inline-flex"
              color={pathname === '/partner' || pathname === '/sponsors' ? 'primary' : 'medium'}
              onClick={() => navigate(showSponsorNav(extendedUser) ? '/sponsors' : '/partner')}
            >
              <IonIcon slot="start" icon={peopleOutline} />
              {showSponsorNav(extendedUser) ? 'Sponsors' : 'Partner With Us'}
            </IonButton>
            {user && showBecomeNav(extendedUser) ? (
              <BecomeNavDropdown user={extendedUser!} />
            ) : null}
            <div
              className={`relative z-[100] hidden lg:block ${hideHeaderSearch ? 'lg:hidden' : ''}`}
              ref={searchDropdownRef}
            >
              <IonSearchbar
                className="app-searchbar w-48 xl:w-64"
                value={searchQuery}
                debounce={0}
                placeholder="Search clips, artists, venues..."
                onIonInput={(e) => handleSearchInput(e.detail.value ?? '')}
                onIonFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    goToDiscoverSearch()
                  }
                }}
              />

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
              <IonButtons>
                <IonButton
                  className="hidden md:inline-flex"
                  color="primary"
                  onClick={() => navigate('/upload')}
                >
                  Share
                </IonButton>
                <IonButton
                  className="hidden md:inline-flex"
                  fill="clear"
                  onClick={() => navigate(`/users/${user.id}`)}
                  aria-label="Your profile"
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
                </IonButton>
                <div className="relative hidden md:block">
                  <IonButton
                    fill="clear"
                    color="medium"
                    onClick={() => setShowNotifications(!showNotifications)}
                    aria-label="Notifications"
                  >
                    <IonIcon
                      slot="icon-only"
                      icon={notificationsOutline}
                      className={hasUnreadNotifications(unreadCount) ? 'animate-pulse' : ''}
                    />
                  </IonButton>
                  <NotificationAlertBadge variant="header" />
                  {showNotifications && (
                    <NotificationPanel onClose={() => setShowNotifications(false)} />
                  )}
                </div>
                {isAdminUser(extendedUser) && (
                  <IonButton
                    fill="clear"
                    color="tertiary"
                    className="admin-header-control"
                    onClick={() => navigate('/admin')}
                    aria-label="Admin Dashboard"
                  >
                    <IonIcon slot="icon-only" icon={shieldOutline} />
                  </IonButton>
                )}
                <IonButton
                  fill="clear"
                  color="medium"
                  onClick={logout}
                  aria-label="Sign out"
                >
                  <IonIcon slot="icon-only" icon={logOutOutline} />
                </IonButton>
              </IonButtons>
            ) : (
              <IonButton color="primary" onClick={() => navigate('/auth')}>
                Sign In
              </IonButton>
            )}
          </div>
        </div>
      </IonToolbar>
    </IonHeader>
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
