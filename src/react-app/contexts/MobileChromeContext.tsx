import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type MobileChromeValue = {
  hideBottomNav: boolean;
  setHideBottomNav: (hide: boolean) => void;
};

const MobileChromeContext = createContext<MobileChromeValue | null>(null);

export function MobileChromeProvider({ children }: { children: ReactNode }) {
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const value = useMemo(
    () => ({
      hideBottomNav,
      setHideBottomNav,
    }),
    [hideBottomNav]
  );
  return <MobileChromeContext.Provider value={value}>{children}</MobileChromeContext.Provider>;
}

export function useMobileChrome(): MobileChromeValue {
  const ctx = useContext(MobileChromeContext);
  if (!ctx) {
    return { hideBottomNav: false, setHideBottomNav: () => {} };
  }
  return ctx;
}
