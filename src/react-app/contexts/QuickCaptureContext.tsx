import { createContext, useContext, type ReactNode } from 'react';
import {
  useQuickCaptureLauncher,
  type QuickCaptureLauncherState,
} from '@/react-app/hooks/useQuickCaptureLauncher';

const QuickCaptureContext = createContext<QuickCaptureLauncherState | null>(null);

export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const value = useQuickCaptureLauncher();
  return (
    <QuickCaptureContext.Provider value={value}>{children}</QuickCaptureContext.Provider>
  );
}

export function useQuickCapture(): QuickCaptureLauncherState {
  const ctx = useContext(QuickCaptureContext);
  if (!ctx) {
    throw new Error('useQuickCapture must be used within QuickCaptureProvider');
  }
  return ctx;
}
