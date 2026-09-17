import JamBaseWordmark from '@/react-app/components/JamBaseWordmark';

export const JAMBASE_HOME_URL = 'https://www.jambase.com';

type PoweredByJamBaseProps = {
  variant: 'nav' | 'splash' | 'line';
  className?: string;
};

export default function PoweredByJamBase({ variant, className = '' }: PoweredByJamBaseProps) {
  if (variant === 'line') {
    return (
      <a
        href={JAMBASE_HOME_URL}
        target="_blank"
        rel="nofollow noopener noreferrer"
        aria-label="Powered by JamBase"
        className={`whitespace-nowrap text-[7px] font-semibold uppercase tracking-[0.16em] text-gray-400 hover:text-white sm:text-[8px] ${className}`.trim()}
      >
        Powered By JamBase
      </a>
    );
  }

  const isNav = variant === 'nav';

  return (
    <a
      href={JAMBASE_HOME_URL}
      target="_blank"
      rel="nofollow noopener noreferrer"
      aria-label="Powered by JamBase"
      className={
        isNav
          ? 'flex shrink-0 flex-col items-start justify-center leading-none'
          : 'flex flex-col items-center justify-center gap-2'
      }
    >
      <span
        className={
          isNav
            ? 'text-[7px] sm:text-[8px] font-semibold uppercase tracking-[0.16em] text-gray-400'
            : 'text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80'
        }
      >
        Powered By
      </span>
      <JamBaseWordmark
        className={isNav ? 'mt-0.5 h-2.5 w-auto text-white sm:h-3' : 'h-7 w-auto text-white sm:h-8'}
      />
    </a>
  );
}
