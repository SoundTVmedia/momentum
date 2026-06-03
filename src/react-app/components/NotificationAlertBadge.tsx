import { useNotificationsContext } from '@/react-app/contexts/NotificationsContext';
import {
  formatNotificationBadgeCount,
  hasUnreadNotifications,
} from '@/react-app/lib/notification-badge';

type NotificationAlertBadgeProps = {
  /** `header` = desktop header bell; `nav` = mobile bottom nav */
  variant?: 'header' | 'nav';
};

/** Unread count on alert bells — same number as the modal Unread tab. */
export default function NotificationAlertBadge({
  variant = 'header',
}: NotificationAlertBadgeProps) {
  const { unreadNotifications } = useNotificationsContext();
  const count = unreadNotifications.length;

  if (!hasUnreadNotifications(count)) return null;

  const label = formatNotificationBadgeCount(count);
  const twoDigits = label.length > 1;

  if (variant === 'nav') {
    return (
      <span
        className={`absolute -top-1.5 -right-1.5 momentum-grad-interactive rounded-full text-white flex items-center justify-center font-bold shadow-lg shadow-momentum-ember/40 ${
          twoDigits
            ? 'min-w-[1.125rem] h-4 px-0.5 text-[9px] leading-none'
            : 'min-w-[1rem] h-4 px-0.5 text-[10px]'
        }`}
      >
        {label}
      </span>
    );
  }

  return (
    <>
      <span
        className={`absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 momentum-grad-interactive rounded-full text-white flex items-center justify-center font-bold shadow-lg shadow-momentum-ember/40 animate-pulse ${
          twoDigits
            ? 'min-w-[1.125rem] h-4 sm:min-w-[1.25rem] sm:h-5 px-0.5 text-[9px] sm:text-[10px] leading-none'
            : 'w-4 h-4 sm:w-5 sm:h-5 text-[10px] sm:text-xs'
        }`}
      >
        {label}
      </span>
      <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 bg-momentum-ember rounded-full animate-ping opacity-75" />
    </>
  );
}
