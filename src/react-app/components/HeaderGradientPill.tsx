import type { ReactNode } from 'react';

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
      className={`header-gradient-pill inline-flex shrink-0 items-center justify-center px-3 lg:px-4 py-1.5 text-xs lg:text-sm font-medium text-white whitespace-nowrap ${className}`}
    >
      {children}
    </button>
  );
}
