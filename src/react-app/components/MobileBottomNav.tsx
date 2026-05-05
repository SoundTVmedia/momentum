import { Home, Search, Bell, User, Video } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import { useAuth } from '@getmocha/users-service/react';
import { useNotifications } from '@/react-app/hooks/useNotifications';
import { useState } from 'react';
import QuickRecordButton from './QuickRecordButton';

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [showQuickCapture, setShowQuickCapture] = useState(false);

  const handleCaptureClick = () => {
    // Open camera modal directly - no auth check required
    setShowQuickCapture(true);
  };

  const navItems = [
    { icon: Home, label: 'Home', path: '/', onClick: () => navigate('/') },
    { icon: Search, label: 'Discover', path: '/discover', onClick: () => navigate('/discover') },
    { icon: Video, label: 'Capture Moment', path: '/capture', onClick: handleCaptureClick, special: true },
    { icon: Bell, label: 'Alerts', path: '/notifications', onClick: () => user ? navigate('/notifications') : navigate('/auth'), badge: unreadCount },
    { icon: User, label: 'Profile', path: '/dashboard', onClick: () => user ? navigate('/dashboard') : navigate('/auth') },
  ];

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-strong border-t border-white/10 bottom-nav">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            if (item.special) {
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  title="Capture Moment"
                  aria-label="Capture Moment"
                  className="flex flex-col items-center justify-center relative transform transition-all hover:scale-110"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-purple-600 flex items-center justify-center animate-neon-pulse">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </button>
              );
            }

            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all ${
                  active ? 'text-blue-500' : 'text-gray-400'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-6 h-6 transition-all ${active ? 'scale-110' : ''}`} />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-1 font-medium ${active ? 'font-bold' : ''}`}>
                  {item.label}
                </span>
                {active && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full" />
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
          onClose={() => setShowQuickCapture(false)} 
        />
      )}
    </>
  );
}
