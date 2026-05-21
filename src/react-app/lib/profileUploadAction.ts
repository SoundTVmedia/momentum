import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useIsMobileViewport } from '@/react-app/hooks/useIsMobileViewport';

/** On mobile profile CTAs open the camera; on desktop go to the upload page. */
export function useProfileUploadAction(onOpenCapture?: () => void) {
  const navigate = useNavigate();
  const isMobile = useIsMobileViewport();

  return useCallback(() => {
    if (isMobile && onOpenCapture) {
      onOpenCapture();
      return;
    }
    navigate('/upload');
  }, [isMobile, onOpenCapture, navigate]);
}
