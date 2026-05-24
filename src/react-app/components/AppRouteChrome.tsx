import { Outlet, useLocation } from 'react-router';
import ClipDeepLinkHandler from '@/react-app/components/ClipDeepLinkHandler';
import MobileBottomNav from '@/react-app/components/MobileBottomNav';
import { useMobileChrome } from '@/react-app/contexts/MobileChromeContext';
import { MOBILE_PAGE_INSET_BOTTOM_CLASS } from '@/react-app/lib/mobileBottomNavLayout';

function shouldHideBottomNavForPath(pathname: string): boolean {
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

/** Wraps routed pages with mobile bottom inset when the tab bar is visible. */
export default function AppRouteChrome() {
  const { hideBottomNav } = useMobileChrome();
  const { pathname } = useLocation();
  const showMobileNavInset = !hideBottomNav && !shouldHideBottomNavForPath(pathname);

  return (
    <>
      <div className={showMobileNavInset ? MOBILE_PAGE_INSET_BOTTOM_CLASS : undefined}>
        <Outlet />
      </div>
      <MobileBottomNav />
      <ClipDeepLinkHandler />
    </>
  );
}
