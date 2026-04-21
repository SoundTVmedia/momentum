import { useState, useEffect } from 'react';

type NetworkSpeed = 'fast' | 'slow' | 'offline';

interface NetworkStatus {
  isOnline: boolean;
  speed: NetworkSpeed;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    speed: 'fast',
  });

  useEffect(() => {
    const updateOnlineStatus = () => {
      setStatus(prev => ({
        ...prev,
        isOnline: navigator.onLine,
        speed: navigator.onLine ? prev.speed : 'offline',
      }));
    };

    const updateConnectionSpeed = () => {
      const connection = (navigator as any).connection || 
                        (navigator as any).mozConnection || 
                        (navigator as any).webkitConnection;

      if (connection) {
        const effectiveType = connection.effectiveType;
        let speed: NetworkSpeed = 'fast';

        if (!navigator.onLine) {
          speed = 'offline';
        } else if (effectiveType === 'slow-2g' || effectiveType === '2g') {
          speed = 'slow';
        } else if (effectiveType === '3g') {
          speed = 'slow';
        } else {
          speed = 'fast';
        }

        setStatus({
          isOnline: navigator.onLine,
          speed,
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
        });
      }
    };

    // Initial check
    updateConnectionSpeed();

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Listen for connection changes
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      connection.addEventListener('change', updateConnectionSpeed);
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      
      if (connection) {
        connection.removeEventListener('change', updateConnectionSpeed);
      }
    };
  }, []);

  return status;
}
