import { Home, Search, Bell, Video } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { useNotifications } from '@/react-app/hooks/useNotifications';
import { useState } from 'react';
import QuickRecordButton from './QuickRecordButton';
import UserAvatar from './UserAvatar';
import type { ExtendedMochaUser } from '@/shared/types';
import { primeCameraOnUserGesture } from '@/react-app/utils/primeCameraOnUserGesture';
import {
  primeGeolocationOnUserGesture,
  type PrimedCaptureGeo,
} from '@/react-app/utils/primeGeolocationOnUserGesture';
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hideBottomNav } = useMobileChrome();
  const { user, isPending } = useAuth();
  const extendedUser = user as ExtendedMochaUser | null;
  const oauthUser = user as { google_user_data?: { picture?: string; name?: string } } | null;
  const { unreadCount } = useNotifications();
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [primedMediaStream, setPrimedMediaStream] = useState<MediaStream | null>(null);
  /** When true, camera was opened on the same tap as Capture (iOS); skip deferred getUserMedia. */
  const [openedWithGestureCamera, setOpenedWithGestureCamera] = useState(false);
  /** While primeCameraOnUserGesture() promise is pending — child must not skip fallback with auto=false + no stream. */
  const [gesturePrimePending, setGesturePrimePending] = useState(false);
  /** GPS started in the same tap as Capture (location prompt only on camera launch). */
  const [captureLaunchGeo, setCaptureLaunchGeo] = useState<PrimedCaptureGeo | null>(null);
  const [captureLaunchGeoResolved, setCaptureLaunchGeoResolved] = useState(false);

  const handleCaptureClick = () => {
    if (isPending) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    /** Must run before any setState so Chrome keeps this click as the user activation for geolocation. */
    const geoPromise = primeGeolocationOnUserGesture();

    setCaptureLaunchGeo(null);
    setCaptureLaunchGeoResolved(false);
    setOpenedWithGestureCamera(false);
    setPrimedMediaStream(null);
    setGesturePrimePending(true);

    setShowQuickCapture(true);

    void geoPromise
      .then((g) => {
        setCaptureLaunchGeo(g);
        setCaptureLaunchGeoResolved(true);
        return primeCameraOnUserGesture();
      })
      .then((stream) => {
        setOpenedWithGestureCamera(!!stream);
        setPrimedMediaStream(stream);
      })
      .catch(() => {
        setOpenedWithGestureCamera(false);
        setPrimedMediaStream(null);
      })
      .finally(() => {
        setGesturePrimePending(false);
      });
  };

  const handleQuickCaptureClose = () => {
    primedMediaStream?.getTracks().forEach((t) => t.stop());
    setPrimedMediaStream(null);
    setOpenedWithGestureCamera(false);
    setGesturePrimePending(false);
    setCaptureLaunchGeo(null);
    setCaptureLaunchGeoResolved(false);
    setShowQuickCapture(false);
  };

  const profilePath = user ? `/users/${user.id}` : '/auth';

  const navItems = [
    { icon: Home, label: 'The Feed', path: '/', onClick: () => navigate('/') },
    { icon: Search, label: 'Discover', path: '/discover', onClick: () => navigate('/discover') },
    { icon: Video, label: 'Capture Moment', path: '/capture', onClick: handleCaptureClick, special: true },
    { icon: Bell, label: 'Alerts', path: '/notifications', onClick: () => user ? navigate('/notifications') : navigate('/auth'), badge: unreadCount },
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
        <div className="flex items-center justify-around h-16 px-2">
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
                  className="flex items-center justify-center relative transform transition-all hover:scale-110"
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
                  className={`flex items-center justify-center flex-1 h-full relative transition-all ${
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
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                aria-label={item.label}
                title={item.label}
                className={`flex items-center justify-center flex-1 h-full relative transition-all ${
                  active ? 'text-momentum-flare' : 'text-gray-400'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 transition-all ${active ? 'scale-110' : ''}`} />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-2 -right-2 w-4 h-4 momentum-grad-interactive rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                {active && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-0.5 momentum-grad-interactive rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Quick Capture Modal */}
      {showQuickCapture && (
        <QuickRecordButton
          isOpen={showQuickCapture}
          primedMediaStream={primedMediaStream}
          gestureCameraPrimingPending={gesturePrimePending}
          autoRequestCamera={!openedWithGestureCamera && !gesturePrimePending}
          captureLaunchGeo={captureLaunchGeo}
          captureLaunchGeoResolved={captureLaunchGeoResolved}
          deferCameraUntilLaunchGeo
          onClose={handleQuickCaptureClose}
        />
      )}
    </>
  );
}
