import { useEffect, useState } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import {
  IonBadge,
  IonFooter,
  IonIcon,
  IonLabel,
  IonModal,
  IonTabBar,
  IonTabButton,
} from '@ionic/react';
import {
  cloudUploadOutline,
  home,
  homeOutline,
  logInOutline,
  notifications,
  notificationsOutline,
  shieldOutline,
  videocam,
} from 'ionicons/icons';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { useUnreadNotificationCount } from '@/react-app/contexts/NotificationsContext';
import { useClipUploadQueue } from '@/react-app/contexts/ClipUploadQueueContext';
import NotificationPanel from '@/react-app/components/NotificationPanel';
import { hasUnreadNotifications } from '@/react-app/lib/notification-badge';
import UserAvatar from './UserAvatar';
import type { ExtendedMochaUser } from '@/shared/types';
import { isAdminUser } from '@/react-app/lib/program-nav';
import { useQuickCapture } from '@/react-app/contexts/QuickCaptureContext';
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext';
import { useIsMobileViewport } from '@/react-app/hooks/useIsMobileViewport';

async function tapHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* web / unsupported */
  }
}

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hideBottomNav } = useMobileChrome();
  const { user } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;
  const isMobileViewport = useIsMobileViewport();
  const staffUser = isAdminUser(extendedUser);
  const oauthUser = user as { google_user_data?: { picture?: string; name?: string } } | null;
  const unreadCount = useUnreadNotificationCount();
  const { jobs: uploadJobs } = useClipUploadQueue();
  const quickCapture = useQuickCapture();
  const [showNotifications, setShowNotifications] = useState(false);

  const profilePath = user ? `/users/${user.id}` : '/auth';

  useEffect(() => {
    setShowNotifications(false);
  }, [location.pathname]);

  const uploadQueueCount = uploadJobs.filter(
    (job) =>
      job.status === 'queued' ||
      job.status === 'classifying' ||
      job.status === 'uploading' ||
      job.status === 'completing' ||
      job.status === 'processing' ||
      job.status === 'paused' ||
      job.status === 'failed',
  ).length;

  const selectedTab = (() => {
    if (showNotifications) return 'alerts';
    if (location.pathname === '/') return 'home';
    if (location.pathname === '/upload-queue' || location.pathname.startsWith('/upload-queue/')) {
      return 'queue';
    }
    if (location.pathname === profilePath || location.pathname.startsWith('/users/')) {
      return 'profile';
    }
    return '';
  })();

  const hideOnAuthRoute =
    location.pathname === '/auth' || location.pathname.startsWith('/auth/');

  if (hideBottomNav || hideOnAuthRoute || quickCapture.showQuickCapture) {
    return null;
  }

  return (
    <>
      <IonFooter className="app-tab-footer ion-no-border bottom-nav">
        {staffUser ? (
          <button
            type="button"
            onClick={() => navigate('/admin')}
            title="Admin Dashboard"
            aria-label="Admin Dashboard"
            className="admin-mobile-entry absolute -top-12 right-3 z-10 p-2 rounded-full glass-chrome border border-momentum-rose/35 text-momentum-rose hover:text-white hover:bg-momentum-rose/20"
          >
            <IonIcon icon={shieldOutline} className="text-xl" />
          </button>
        ) : null}
        <IonTabBar className="app-tab-bar" selectedTab={selectedTab}>
          <IonTabButton
            tab="home"
            onClick={() => {
              void tapHaptic();
              navigate('/');
            }}
          >
            <IonIcon icon={selectedTab === 'home' ? home : homeOutline} />
            <IonLabel>Home</IonLabel>
          </IonTabButton>

          <IonTabButton
            tab="queue"
            onClick={() => {
              void tapHaptic();
              navigate(user ? '/upload-queue' : '/auth');
            }}
            aria-label={
              uploadQueueCount > 0 ? `Upload Queue, ${uploadQueueCount} uploading` : 'Upload Queue'
            }
          >
            <IonIcon icon={cloudUploadOutline} />
            <IonLabel>Queue</IonLabel>
            {uploadQueueCount > 0 ? (
              <IonBadge color="primary">{uploadQueueCount > 9 ? '9+' : uploadQueueCount}</IonBadge>
            ) : null}
          </IonTabButton>

          <IonTabButton
            tab="capture"
            className="app-tab-capture"
            onClick={() => {
              void tapHaptic();
              quickCapture.openQuickCapture();
            }}
            aria-label="Capture Moment"
          >
            <div className="app-capture-fab">
              <IonIcon icon={videocam} className="text-2xl text-white" />
            </div>
          </IonTabButton>

          <IonTabButton
            tab="alerts"
            onClick={() => {
              void tapHaptic();
              if (!user) {
                navigate('/auth');
                return;
              }
              setShowNotifications((open) => !open);
            }}
            aria-label={
              hasUnreadNotifications(unreadCount) ? `Alerts, ${unreadCount} unread` : 'Alerts'
            }
            aria-expanded={showNotifications}
          >
            <IonIcon icon={showNotifications ? notifications : notificationsOutline} />
            <IonLabel>Alerts</IonLabel>
            {hasUnreadNotifications(unreadCount) ? (
              <IonBadge color="danger">{unreadCount > 9 ? '9+' : unreadCount}</IonBadge>
            ) : null}
          </IonTabButton>

          <IonTabButton
            tab="profile"
            onClick={() => {
              void tapHaptic();
              navigate(user ? profilePath : '/auth');
            }}
            aria-label={user ? 'Profile' : 'Sign in'}
          >
            {user ? (
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
                seed={user.id}
                sizeClass="w-7 h-7"
                letterClassName="text-[10px] font-semibold"
              />
            ) : (
              <IonIcon icon={logInOutline} />
            )}
            <IonLabel>{user ? 'Profile' : 'Sign in'}</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonFooter>

      {staffUser && isMobileViewport ? (
        <button
          type="button"
          onClick={() => navigate('/admin')}
          title="Admin Dashboard"
          aria-label="Admin Dashboard"
          className="admin-mobile-entry hidden min-[768px]:inline-flex fixed z-[55] p-2 rounded-full glass-chrome border border-momentum-rose/35 text-momentum-rose hover:text-white hover:bg-momentum-rose/20"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
            right: '0.75rem',
          }}
        >
          <IonIcon icon={shieldOutline} className="text-xl" />
        </button>
      ) : null}

      <IonModal
        className="app-alerts-modal"
        isOpen={showNotifications && !!user}
        onDidDismiss={() => setShowNotifications(false)}
        breakpoints={[0, 0.55, 0.92]}
        initialBreakpoint={0.92}
        handle
      >
        <NotificationPanel variant="mobile" onClose={() => setShowNotifications(false)} />
      </IonModal>
    </>
  );
}
