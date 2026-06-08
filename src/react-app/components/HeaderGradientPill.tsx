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
    <span
      className={`inline-flex shrink-0 rounded-full bg-gradient-to-r from-momentum-ember via-momentum-flare to-momentum-rose p-px ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        className="rounded-full bg-transparent px-3 lg:px-4 py-1.5 text-xs lg:text-sm font-medium text-white whitespace-nowrap transition-colors hover:bg-white/5"
      >
        {children}
      </button>
    </span>
  );
}
