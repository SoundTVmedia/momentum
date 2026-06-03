import { useEffect, useId, useState } from 'react';
import { Home, Search, Bell, Video, LogIn } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { useNotificationsContext } from '@/react-app/contexts/NotificationsContext';
import NotificationPanel from '@/react-app/components/NotificationPanel';
import QuickCaptureOverlay from '@/react-app/components/QuickCaptureOverlay';
import UserAvatar from './UserAvatar';
import type { ExtendedMochaUser } from '@/shared/types';
import { useQuickCaptureLauncher } from '@/react-app/hooks/useQuickCaptureLauncher';
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext';

const SIGN_IN_GRADIENT_STOPS = (
  <>
    <stop offset="0%" stopColor="var(--momentum-ember, #22d3ee)" />
    <stop offset="50%" stopColor="var(--momentum-flare, #3b82f6)" />
    <stop offset="100%" stopColor="var(--momentum-rose, #6366f1)" />
  </>
);

export default function MobileBottomNav() {
  const signInGradId = useId().replace(/:/g, '');
  const navigate = useNavigate();
  const location = useLocation();
  const { hideBottomNav } = useMobileChrome();
  const { user } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;
  const oauthUser = user as { google_user_data?: { picture?: string; name?: string } } | null;
  const { unreadCount } = useNotificationsContext();
  const quickCapture = useQuickCaptureLauncher();
  const [showNotifications, setShowNotifications] = useState(false);

  const profilePath = user ? `/users/${user.id}` : '/auth';

  useEffect(() => {
    setShowNotifications(false);
  }, [location.pathname]);

  const navItems = [
    { icon: Home, label: 'The Feed', path: '/', onClick: () => navigate('/') },
    { icon: Search, label: 'Discover', path: '/discover', onClick: () => navigate('/discover') },
    { icon: Video, label: 'Capture Moment', path: '/capture', onClick: quickCapture.openQuickCapture, special: true },
    {
      icon: Bell,
      label: 'Alerts',
      path: '__alerts__',
      onClick: () => {
        if (!user) {
          navigate('/auth');
          return;
        }
        setShowNotifications((open) => !open);
      },
      unreadCount,
      alerts: true,
    },
    {
      label: 'Profile',
      path: profilePath,
      onClick: () => (user ? navigate(profilePath) : navigate('/auth')),
      profile: true,
    },
  ];

  const isActive = (path: string) => {
    if (path === '__alerts__') {
      return showNotifications;
    }
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/auth') {
      return false;
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const hideOnAuthRoute =
    location.pathname === '/auth' || location.pathname.startsWith('/auth/');

  if (hideBottomNav || hideOnAuthRoute) {
    return null;
  }

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-chrome border-t border-white/10 bottom-nav">
        <div className="grid grid-cols-5 items-center h-16 w-full">
          {navItems.map((item) => {
            const active = isActive(item.path);

            if (item.special && item.icon) {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  title="Capture Moment"
                  aria-label="Capture Moment"
                  className="flex items-center justify-center w-full h-full relative transform transition-all hover:scale-110"
                >
                  <div className="w-12 h-12 rounded-full momentum-grad-interactive flex items-center justify-center animate-neon-pulse">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </button>
              );
            }

            if (item.profile) {
              const profileLabel = user ? item.label : 'Sign in';
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  aria-label={profileLabel}
                  title={profileLabel}
                  className={`flex items-center justify-center w-full h-full relative transition-all ${
                    active ? 'text-momentum-flare' : 'text-gray-400'
                  }`}
                >
                  <div className="relative">
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
                        sizeClass="w-8 h-8"
                        letterClassName="text-xs font-semibold"
                      />
                    ) : (
                      <div className="relative flex h-8 w-8 items-center justify-center">
                        <svg aria-hidden className="h-8 w-8" viewBox="0 0 32 32">
                          <defs>
                            <linearGradient
                              id={signInGradId}
                              x1="0%"
                              y1="0%"
                              x2="100%"
                              y2="100%"
                            >
                              {SIGN_IN_GRADIENT_STOPS}
                            </linearGradient>
                          </defs>
                          <circle
                            cx="16"
                            cy="16"
                            r="14.25"
                            fill="none"
                            stroke={`url(#${signInGradId})`}
                            strokeWidth="1.5"
                          />
                        </svg>
                        <LogIn
                          className="absolute h-3.5 w-3.5"
                          stroke={`url(#${signInGradId})`}
                          strokeWidth={2}
                          fill="none"
                          aria-hidden
                        />
                      </div>
                    )}
                  </div>
                  {active && user && (
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-0.5 momentum-grad-interactive rounded-full" />
                  )}
                </button>
              );
            }

            const Icon = item.icon!;
            const unread = 'unreadCount' in item ? Number(item.unreadCount) : 0;
            const alertsLabel =
              item.label === 'Alerts' && unread > 0
                ? `${item.label}, ${unread} unread`
                : item.label;
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                aria-label={alertsLabel}
                title={alertsLabel}
                aria-expanded={item.alerts ? showNotifications : undefined}
                className={`flex items-center justify-center w-full h-full relative transition-all ${
                  active ? 'text-momentum-flare' : 'text-gray-400'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-6 h-6 transition-all ${
                      active ? 'scale-110' : unread > 0 ? 'animate-pulse' : ''
                    }`}
                  />
                  {unread > 0 ? (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-0.5 momentum-grad-interactive rounded-full text-white text-[10px] flex items-center justify-center font-bold shadow-lg shadow-momentum-ember/40">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </div>
                {active && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-0.5 momentum-grad-interactive rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {showNotifications && user ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/50 md:hidden"
            aria-label="Close notifications"
            onClick={() => setShowNotifications(false)}
          />
          <div className="fixed left-0 right-0 bottom-16 z-[70] px-3 md:hidden pointer-events-none">
            <div className="pointer-events-auto max-w-lg mx-auto">
              <NotificationPanel
                variant="mobile"
                onClose={() => setShowNotifications(false)}
              />
            </div>
          </div>
        </>
      ) : null}

      <QuickCaptureOverlay {...quickCapture} />
    </>
  );
}
