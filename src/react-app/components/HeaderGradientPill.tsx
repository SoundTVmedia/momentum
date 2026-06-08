import type { ReactNode } from 'react';

/** Shared sizing with header "Share Your Moment" (padding, type, radius, hover). */
export const HEADER_ACTION_BUTTON_CLASS =
  'px-[0.65rem] py-[0.325rem] rounded-md font-bold text-[0.65rem] leading-tight text-white whitespace-nowrap transition-transform hover:scale-105';

type HeaderGradientPillProps = {
  children: ReactNode;
  onClick: () => void;
  className?: string;
};

export default function HeaderGradientPill({
  children,
  onClick,
  className = '',
}: HeaderGradientPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center bg-transparent shadow-[inset_0_0_0_1.5px_#fff] hover:bg-white/5 ${HEADER_ACTION_BUTTON_CLASS} ${className}`}
    >
      {children}
    </button>
  );
}
