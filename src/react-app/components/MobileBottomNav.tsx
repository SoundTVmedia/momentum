import { Home, Search, Bell, Video } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { useNotifications } from '@/react-app/hooks/useNotifications';
import QuickCaptureOverlay from '@/react-app/components/QuickCaptureOverlay';
import UserAvatar from './UserAvatar';
import type { ExtendedMochaUser } from '@/shared/types';
import { useQuickCaptureLauncher } from '@/react-app/hooks/useQuickCaptureLauncher';
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hideBottomNav } = useMobileChrome();
  const { user } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;
  const oauthUser = user as { google_user_data?: { picture?: string; name?: string } } | null;
  const { unreadCount } = useNotifications();
  const quickCapture = useQuickCaptureLauncher();

  const profilePath = user ? `/users/${user.id}` : '/auth';

  const navItems = [
    { icon: Home, label: 'The Feed', path: '/', onClick: () => navigate('/') },
    { icon: Search, label: 'Discover', path: '/discover', onClick: () => navigate('/discover') },
    { icon: Video, label: 'Capture Moment', path: '/capture', onClick: quickCapture.openQuickCapture, special: true },
    {
      icon: Bell,
      label: 'Alerts',
      path: '/notifications',
      onClick: () => (user ? navigate('/notifications') : navigate('/auth')),
      hasUnread: unreadCount > 0,
    },
    {
      label: 'Profile',
      path: profilePath,
      onClick: () => (user ? navigate(profilePath) : navigate('/auth')),
      profile: true,
    },
  ];

  const isActive = (path: string) => {
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
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  aria-label={item.label}
                  title={item.label}
                  className={`flex items-center justify-center w-full h-full relative transition-all ${
                    active ? 'text-momentum-flare' : 'text-gray-400'
                  }`}
                >
                  <div className="relative">
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
                      sizeClass="w-8 h-8"
                      letterClassName="text-xs font-semibold"
                    />
                  </div>
                  {active && (
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-0.5 momentum-grad-interactive rounded-full" />
                  )}
                </button>
              );
            }

            const Icon = item.icon!;
            const alertsLabel =
              item.label === 'Alerts' && item.hasUnread
                ? `${item.label}, new notifications`
                : item.label;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                aria-label={alertsLabel}
                title={alertsLabel}
                className={`flex items-center justify-center w-full h-full relative transition-all ${
                  active ? 'text-momentum-flare' : 'text-gray-400'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 transition-all ${active ? 'scale-110' : ''}`} />
                  {item.hasUnread ? (
                    <span
                      className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500 ring-2 ring-black/80"
                      aria-hidden
                    />
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

      <QuickCaptureOverlay {...quickCapture} />
    </>
  );
}
