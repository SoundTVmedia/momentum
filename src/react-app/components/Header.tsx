import { useState } from 'react'
import { useAuth } from '@getmocha/users-service/react'
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonToolbar,
} from '@ionic/react'
import { logOutOutline, notificationsOutline, peopleOutline, shieldOutline, cloudUploadOutline } from 'ionicons/icons'
import { useLocation, useNavigate } from 'react-router'
import { useUnreadNotificationCount } from '@/react-app/contexts/NotificationsContext'
import NotificationAlertBadge from './NotificationAlertBadge'
import NotificationPanel from './NotificationPanel'
import { hasUnreadNotifications } from '@/react-app/lib/notification-badge'
import UserAvatar from './UserAvatar'
import type { ExtendedMochaUser } from '@/shared/types'
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext'
import BecomeNavDropdown from '@/react-app/components/BecomeNavDropdown'
import HeroSearchBar from '@/react-app/components/HeroSearchBar'
import MobileNavMoreMenu from '@/react-app/components/MobileNavMoreMenu'
import FeedbackWordmark from '@/react-app/components/FeedbackWordmark'
import PoweredByJamBase from '@/react-app/components/PoweredByJamBase'
import { isAdminUser, showBecomeNav, showSponsorNav } from '@/react-app/lib/program-nav'
import { TOUR_ANCHORS } from '@/react-app/lib/productTour'

export default function Header() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { hideBottomNav: hideSiteChrome } = useMobileChrome()
  const { user, logout } = useAuth()
  const extendedUser = user as ExtendedMochaUser | null
  const oauthUser = user as { google_user_data?: { picture?: string; name?: string } } | null
  const unreadCount = useUnreadNotificationCount()
  const [showNotifications, setShowNotifications] = useState(false)

  if (hideSiteChrome) return null

  return (
    <>
      <IonHeader className="app-top-header ion-no-border">
        <IonToolbar className="app-toolbar">
          <div className="flex w-full min-w-0 items-center justify-between gap-2 md:gap-3">
            <div className="app-header-brand">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="app-header-brand-home"
                aria-label="Feedback home"
              >
                <span className="app-header-mark" aria-hidden>
                  <img src="/favicon.svg" alt="" width={36} height={36} />
                </span>
                <FeedbackWordmark className="app-header-wordmark font-headline" />
              </button>
              <PoweredByJamBase variant="line" className="app-header-powered" />
            </div>

            <div className="hidden min-w-[13rem] flex-1 md:block md:max-w-xl lg:max-w-2xl xl:max-w-3xl">
              <HeroSearchBar className="app-header-search" />
            </div>

            <div className="flex min-w-0 shrink-0 items-center justify-end gap-0.5 sm:gap-1 md:gap-2">
              <MobileNavMoreMenu user={extendedUser} />
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

              {user ? (
                <IonButtons>
                  <IonButton
                    className="hidden md:inline-flex"
                    fill="clear"
                    color="medium"
                    onClick={() => navigate('/upload-queue')}
                    aria-label="Upload queue"
                    data-tour={TOUR_ANCHORS.uploadQueue}
                  >
                    <IonIcon slot="icon-only" icon={cloudUploadOutline} />
                  </IonButton>
                  <IonButton
                    className="hidden md:inline-flex"
                    fill="clear"
                    onClick={() => navigate(`/users/${user.id}`)}
                    aria-label="Your profile"
                    data-tour={TOUR_ANCHORS.profile}
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
                <IonButton className="app-header-signin" color="primary" onClick={() => navigate('/auth')}>
                  Sign In
                </IonButton>
              )}
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      {/* Fixed header is out of flow; spacer keeps page content at the cold-start offset. */}
      <div className="app-header-flow-spacer" aria-hidden />
    </>
  )
}
